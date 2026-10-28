package com.toeic.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

public interface StaffMailGateway {
    void credentials(String email, String password) throws Exception;
    void resetLink(String email, String token) throws Exception;

    @Component
    class Smtp implements StaffMailGateway {
        private final JavaMailSender mail;
        private final String from;
        private final String consoleUrl;
        public Smtp(JavaMailSender mail, @Value("${staff.mail.from:}") String from,
                    @Value("${staff.console-url:http://localhost:5173/console}") String consoleUrl) {
            this.mail = mail; this.from = from; this.consoleUrl = consoleUrl.replaceAll("/+$", "");
        }
        private void send(String email, String subject, String text) {
            if (from.isBlank()) throw new IllegalStateException("Staff mail sender is not configured");
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from); message.setTo(email); message.setSubject(subject); message.setText(text);
            mail.send(message);
        }
        public void credentials(String email, String password) {
            send(email, "CapyTOEIC — Thông tin đăng nhập nhân viên", "Tài khoản nội bộ của bạn đã được tạo.\n\nĐăng nhập: " + consoleUrl
                    + "\nTên đăng nhập (email): " + email + "\nMật khẩu tạm: " + password
                    + "\n\nMật khẩu tạm có hiệu lực 24 giờ kể từ lúc cấp và phải đổi ở lần đăng nhập đầu. Nếu nhận nhiều email, hãy dùng mật khẩu trong email mới nhất.\nKhông chia sẻ thông tin đăng nhập.");
        }
        public void resetLink(String email, String token) {
            // Fragment keeps the bearer token out of web-server access logs and Referer headers.
            String link = consoleUrl + "/reset-password#email=" + java.net.URLEncoder.encode(email, java.nio.charset.StandardCharsets.UTF_8) + "&token=" + token;
            send(email, "CapyTOEIC — Đặt lại mật khẩu", "Bạn vừa yêu cầu đặt lại mật khẩu.\n\nMở liên kết để tạo mật khẩu mới: "
                    + link + "\n\nLiên kết có hiệu lực 1 giờ và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.");
        }
    }
}
