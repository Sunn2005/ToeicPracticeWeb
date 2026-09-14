package com.toeic.security;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

public class ToeicAuthenticationToken extends AbstractAuthenticationToken {

    private final ToeicUserPrincipal principal;

    public ToeicAuthenticationToken(
            ToeicUserPrincipal principal,
            Collection<? extends GrantedAuthority> authorities
    ) {
        super(authorities);
        this.principal = principal;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public ToeicUserPrincipal getPrincipal() {
        return principal;
    }

    @Override
    public String getName() {
        return principal.uid();
    }
}
