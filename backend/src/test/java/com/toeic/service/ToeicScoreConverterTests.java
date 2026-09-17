package com.toeic.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ToeicScoreConverterTests {

    @Test
    void convertsListeningBoundariesFromProvidedScale() {
        assertEquals(15, ToeicScoreConverter.listeningScore(0, 100));
        assertEquals(15, ToeicScoreConverter.listeningScore(1, 100));
        assertEquals(20, ToeicScoreConverter.listeningScore(2, 100));
        assertEquals(490, ToeicScoreConverter.listeningScore(96, 100));
        assertEquals(495, ToeicScoreConverter.listeningScore(97, 100));
        assertEquals(495, ToeicScoreConverter.listeningScore(100, 100));
    }

    @Test
    void convertsReadingBoundariesFromProvidedScale() {
        assertEquals(10, ToeicScoreConverter.readingScore(0, 100));
        assertEquals(10, ToeicScoreConverter.readingScore(1, 100));
        assertEquals(10, ToeicScoreConverter.readingScore(3, 100));
        assertEquals(15, ToeicScoreConverter.readingScore(4, 100));
        assertEquals(490, ToeicScoreConverter.readingScore(99, 100));
        assertEquals(495, ToeicScoreConverter.readingScore(100, 100));
    }

    @Test
    void normalizesPartialAttemptsToOneHundredQuestions() {
        assertEquals(270, ToeicScoreConverter.listeningScore(13, 25));
        assertEquals(295, ToeicScoreConverter.readingScore(18, 30));
    }

    @Test
    void returnsZeroWhenAttemptDoesNotContainThatSection() {
        assertEquals(0, ToeicScoreConverter.listeningScore(0, 0));
        assertEquals(0, ToeicScoreConverter.readingScore(0, 0));
    }

    @Test
    void clampsInvalidCorrectCountsBeforeConversion() {
        assertEquals(15, ToeicScoreConverter.listeningScore(-1, 100));
        assertEquals(495, ToeicScoreConverter.readingScore(101, 100));
    }
}
