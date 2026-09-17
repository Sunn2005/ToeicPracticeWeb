package com.toeic.ai_service.config;

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
public class RabbitMqConfig {

    @Bean
    DirectExchange aiExchange(
            @Value("${app.rabbitmq.exchange}") String name
    ) {
        return new DirectExchange(name, true, false);
    }

    @Bean
    DirectExchange aiDeadLetterExchange(
            @Value("${app.rabbitmq.dead-letter-exchange}") String name
    ) {
        return new DirectExchange(name, true, false);
    }

    @Bean
    Queue aiRequestQueue(
            @Value("${app.rabbitmq.request-queue}") String queueName,
            @Value("${app.rabbitmq.dead-letter-exchange}") String deadLetterExchange,
            @Value("${app.rabbitmq.dead-letter-routing-key}") String deadLetterRoutingKey
    ) {
        return QueueBuilder.durable(queueName)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(deadLetterRoutingKey)
                .build();
    }

    @Bean
    Queue aiResultQueue(
            @Value("${app.rabbitmq.result-queue}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    Queue aiReviewRequestQueue(
            @Value("${app.rabbitmq.review-request-queue}") String queueName,
            @Value("${app.rabbitmq.dead-letter-exchange}") String deadLetterExchange,
            @Value("${app.rabbitmq.dead-letter-routing-key}") String deadLetterRoutingKey
    ) {
        return QueueBuilder.durable(queueName)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(deadLetterRoutingKey)
                .build();
    }

    @Bean
    Queue aiReviewCompletedQueue(
            @Value("${app.rabbitmq.review-completed-queue}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    Queue aiReviewFailedQueue(
            @Value("${app.rabbitmq.review-failed-queue}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    Queue aiDeadLetterQueue(
            @Value("${app.rabbitmq.dead-letter-queue}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    Binding aiRequestBinding(
            Queue aiRequestQueue,
            DirectExchange aiExchange,
            @Value("${app.rabbitmq.request-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiRequestQueue)
                .to(aiExchange)
                .with(routingKey);
    }

    @Bean
    Binding aiResultBinding(
            Queue aiResultQueue,
            DirectExchange aiExchange,
            @Value("${app.rabbitmq.result-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiResultQueue)
                .to(aiExchange)
                .with(routingKey);
    }

    @Bean
    Binding aiReviewRequestBinding(
            Queue aiReviewRequestQueue,
            DirectExchange aiExchange,
            @Value("${app.rabbitmq.review-request-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiReviewRequestQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiReviewCompletedBinding(
            Queue aiReviewCompletedQueue,
            DirectExchange aiExchange,
            @Value("${app.rabbitmq.review-completed-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiReviewCompletedQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiReviewFailedBinding(
            Queue aiReviewFailedQueue,
            DirectExchange aiExchange,
            @Value("${app.rabbitmq.review-failed-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiReviewFailedQueue).to(aiExchange).with(routingKey);
    }

    @Bean
    Binding aiDeadLetterBinding(
            Queue aiDeadLetterQueue,
            DirectExchange aiDeadLetterExchange,
            @Value("${app.rabbitmq.dead-letter-routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(aiDeadLetterQueue)
                .to(aiDeadLetterExchange)
                .with(routingKey);
    }

    @Bean
    MessageConverter rabbitMessageConverter() {
        return new JacksonJsonMessageConverter();
    }
}
