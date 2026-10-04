package com.toeic.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMessagingConfig {

    @Bean
    DirectExchange aiExchange(@Value("${app.ai.exchange}") String name) {
        return new DirectExchange(name, true, false);
    }

    @Bean
    DirectExchange aiDeadLetterExchange(@Value("${app.ai.dead-letter-exchange}") String name) {
        return new DirectExchange(name, true, false);
    }

    @Bean
    Queue aiReviewRequestQueue(
            @Value("${app.ai.review-request-queue}") String name,
            @Value("${app.ai.dead-letter-exchange}") String deadLetterExchange,
            @Value("${app.ai.dead-letter-routing-key}") String deadLetterRoutingKey
    ) {
        return QueueBuilder.durable(name)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(deadLetterRoutingKey)
                .build();
    }

    @Bean
    Queue aiDeadLetterQueue(@Value("${app.ai.dead-letter-queue}") String name) {
        return QueueBuilder.durable(name).build();
    }

    @Bean
    Queue aiReviewCompletedQueue(@Value("${app.ai.review-completed-queue}") String name) {
        return QueueBuilder.durable(name).build();
    }

    @Bean
    Queue aiReviewFailedQueue(@Value("${app.ai.review-failed-queue}") String name) {
        return QueueBuilder.durable(name).build();
    }

    @Bean
    Queue aiChatRequestQueue(
            @Value("${app.ai.chat-request-queue}") String name,
            @Value("${app.ai.dead-letter-exchange}") String deadLetterExchange,
            @Value("${app.ai.dead-letter-routing-key}") String deadLetterRoutingKey
    ) {
        return QueueBuilder.durable(name)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(deadLetterRoutingKey)
                .build();
    }

    @Bean
    Queue aiChatResultQueue(@Value("${app.ai.chat-result-queue}") String name) {
        return QueueBuilder.durable(name).build();
    }

    @Bean
    Binding aiReviewRequestBinding(
            Queue aiReviewRequestQueue,
            DirectExchange aiExchange,
            @Value("${app.ai.review-request-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiReviewRequestQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiReviewCompletedBinding(
            Queue aiReviewCompletedQueue,
            DirectExchange aiExchange,
            @Value("${app.ai.review-completed-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiReviewCompletedQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiReviewFailedBinding(
            Queue aiReviewFailedQueue,
            DirectExchange aiExchange,
            @Value("${app.ai.review-failed-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiReviewFailedQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiChatRequestBinding(
            Queue aiChatRequestQueue,
            DirectExchange aiExchange,
            @Value("${app.ai.chat-request-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiChatRequestQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiChatResultBinding(
            Queue aiChatResultQueue,
            DirectExchange aiExchange,
            @Value("${app.ai.chat-result-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiChatResultQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiDeadLetterBinding(
            Queue aiDeadLetterQueue,
            DirectExchange aiDeadLetterExchange,
            @Value("${app.ai.dead-letter-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiDeadLetterQueue).to(aiDeadLetterExchange).with(routingKey);
    }

    @Bean
    MessageConverter rabbitMessageConverter() {
        return new JacksonJsonMessageConverter();
    }
}
