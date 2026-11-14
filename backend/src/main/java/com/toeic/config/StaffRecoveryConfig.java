package com.toeic.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class StaffRecoveryConfig {
    @Bean("staffRecoveryExecutor")
    public ThreadPoolTaskExecutor staffRecoveryExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1); executor.setMaxPoolSize(2); executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("staff-recovery-"); return executor;
    }
}
