package com.toeic.dao;

import com.toeic.model.User;

import java.util.Optional;

public interface UserDao {

    Optional<User> findByUid(String uid) throws Exception;

    void save(User user) throws Exception;
}
