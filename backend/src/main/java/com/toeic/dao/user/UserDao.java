package com.toeic.dao.user;

import com.toeic.model.user.User;

import java.util.Optional;

public interface UserDao {

    Optional<User> findByUid(String uid) throws Exception;

    void save(User user) throws Exception;
}
