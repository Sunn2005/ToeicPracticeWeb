package com.toeic.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Flow;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MediaStorageServiceTests {
    private static final String BASE_URL = "https://storage.example.test";
    private static final String TEST_KEY = "dummy-server-key";
    private final HttpClient httpClient = mock(HttpClient.class);
    private final MediaStorageService service = new MediaStorageService(BASE_URL + "/", TEST_KEY, httpClient);

    @AfterEach
    void clearInterrupt() {
        Thread.interrupted();
    }

    @ParameterizedTest
    @ValueSource(strings = {"image/jpeg", "image/png", "image/webp", "image/gif",
            "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg"})
    void uploadsRawBytesToSupabaseAndReturnsPublicUrl(String contentType) throws Exception {
        respondWith(200);
        byte[] contents = {1, 2, 3, 4};
        var file = new MockMultipartFile("file", "sample file", contentType, contents);

        var result = service.upload("employee-1", file);

        var captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(captor.capture(), any(HttpResponse.BodyHandler.class));
        HttpRequest request = captor.getValue();
        String objectName = (String) result.get("objectName");
        assertTrue(objectName.matches("employee-1/[a-f0-9-]{36}-sample-file"));
        assertEquals(BASE_URL + "/storage/v1/object/toeic-media/" + objectName, request.uri().toString());
        assertEquals("POST", request.method());
        assertEquals(TEST_KEY, request.headers().firstValue("apikey").orElseThrow());
        assertEquals("Bearer " + TEST_KEY, request.headers().firstValue("Authorization").orElseThrow());
        assertEquals(contentType, request.headers().firstValue("Content-Type").orElseThrow());
        assertEquals("false", request.headers().firstValue("x-upsert").orElseThrow());
        assertEquals(Duration.ofSeconds(60), request.timeout().orElseThrow());
        var subscriber = HttpResponse.BodySubscribers.ofByteArray();
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription subscription) { subscriber.onSubscribe(subscription); }
            public void onNext(ByteBuffer buffer) { subscriber.onNext(List.of(buffer)); }
            public void onError(Throwable error) { subscriber.onError(error); }
            public void onComplete() { subscriber.onComplete(); }
        });
        assertArrayEquals(contents, subscriber.getBody().toCompletableFuture().get());
        assertEquals(BASE_URL + "/storage/v1/object/public/toeic-media/" + objectName, result.get("url"));
        assertEquals("sample file", result.get("fileName"));
        assertEquals(contentType, result.get("contentType"));
        assertEquals(4L, result.get("size"));
        assertEquals(5, result.size());
        assertFalse(result.toString().contains(TEST_KEY));
    }

    @Test
    void encodesUidAsOnePathSegmentAndCreatesUniqueObjects() throws Exception {
        respondWith(201);
        var first = service.upload("employee/a b", audio());
        var second = service.upload("employee/a b", audio());
        assertNotEquals(first.get("objectName"), second.get("objectName"));
        assertTrue(first.get("url").toString().contains("/toeic-media/employee%2Fa%20b/"));
    }

    @Test
    void rejectsEmptyUnsupportedAndOversizedFilesBeforeContactingSupabase() throws Exception {
        assertBadRequest(null);
        assertBadRequest(new MockMultipartFile("file", new byte[0]));
        assertBadRequest(new MockMultipartFile("file", "script.svg", "image/svg+xml", new byte[]{1}));
        assertBadRequest(new MockMultipartFile("file", "audio.mp3", null, new byte[]{1}));
        MultipartFile largeFile = mock(MultipartFile.class);
        when(largeFile.getSize()).thenReturn(15L * 1024 * 1024 + 1);
        assertBadRequest(largeFile);
        verifyNoInteractions(httpClient);
    }

    @Test
    void acceptsFileAtFifteenMiBLimit() throws Exception {
        respondWith(200);
        MultipartFile file = mock(MultipartFile.class);
        when(file.getSize()).thenReturn(15L * 1024 * 1024);
        when(file.getContentType()).thenReturn("audio/mpeg");
        when(file.getBytes()).thenReturn(new byte[]{1});
        assertEquals(15L * 1024 * 1024, service.upload("employee-1", file).get("size"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "not-a-url", "http://storage.example.test", "https://storage.example.test/storage/v1",
            "https://user:pass@storage.example.test", "https://storage.example.test?key=value"})
    void rejectsMissingOrInvalidConfiguration(String url) {
        var unconfigured = new MediaStorageService(url, TEST_KEY, httpClient);
        var error = assertThrows(ResponseStatusException.class, () -> unconfigured.upload("employee-1", audio()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verifyNoInteractions(httpClient);
    }

    @Test
    void rejectsMissingServiceKey() {
        var unconfigured = new MediaStorageService(BASE_URL, " ", httpClient);
        var error = assertThrows(ResponseStatusException.class, () -> unconfigured.upload("employee-1", audio()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verifyNoInteractions(httpClient);
    }

    @ParameterizedTest
    @ValueSource(ints = {301, 400, 401, 403, 404, 413, 429, 500, 503})
    void upstreamFailuresDoNotBecomeSuccessfulUploads(int status) throws Exception {
        respondWith(status);
        var error = assertThrows(ResponseStatusException.class, () -> service.upload("employee-1", audio()));
        assertStorageFailure(error);
    }

    @Test
    void connectionAndTimeoutFailuresAreSanitized() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new IOException(TEST_KEY))
                .thenThrow(new HttpTimeoutException(TEST_KEY));
        for (int i = 0; i < 2; i++) {
            var error = assertThrows(ResponseStatusException.class, () -> service.upload("employee-1", audio()));
            assertStorageFailure(error);
        }
    }

    @Test
    void interruptedUploadRestoresInterruptFlag() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new InterruptedException(TEST_KEY));
        var error = assertThrows(ResponseStatusException.class, () -> service.upload("employee-1", audio()));
        assertStorageFailure(error);
        assertTrue(Thread.currentThread().isInterrupted());
    }

    private void assertBadRequest(MultipartFile file) {
        var error = assertThrows(ResponseStatusException.class, () -> service.upload("employee-1", file));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    private void assertStorageFailure(ResponseStatusException error) {
        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertFalse(error.getMessage().contains(TEST_KEY));
        assertNull(error.getCause());
    }

    @SuppressWarnings("unchecked")
    private void respondWith(int status) throws Exception {
        HttpResponse<Void> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    private MockMultipartFile audio() {
        return new MockMultipartFile("file", "audio.mp3", "audio/mpeg", new byte[]{1, 2, 3});
    }
}
