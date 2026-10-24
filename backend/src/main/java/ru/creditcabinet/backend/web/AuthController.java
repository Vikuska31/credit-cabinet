package ru.creditcabinet.backend.web;

import org.springframework.web.bind.annotation.*;
import ru.creditcabinet.backend.auth.AuthService;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.auth.ProfileService;
import ru.creditcabinet.backend.config.WebConfig;
import ru.creditcabinet.backend.demo.DemoSeed;
import ru.creditcabinet.backend.domain.Role;

import java.util.List;

@RestController
@RequestMapping("/api")
public class AuthController {
    public record LoginRequest(String login, String password) {}
    public record DemoLoginRequest(String profileId) {}
    public record LoginResponse(String token, Role role, String fullName, String companyInn) {}

    private final AuthService auth;
    private final DemoSeed seed;
    private final ProfileService profiles;

    public AuthController(AuthService auth, DemoSeed seed, ProfileService profiles) {
        this.auth = auth;
        this.seed = seed;
        this.profiles = profiles;
    }

    @GetMapping("/health")
    public java.util.Map<String, String> health() { return java.util.Map.of("status", "ok"); }

    @PostMapping("/auth/login")
    public LoginResponse login(@RequestBody LoginRequest r) {
        return response(auth.login(r.login(), r.password(), Role.CLIENT));
    }

    @PostMapping("/auth/staff/login")
    public LoginResponse staffLogin(@RequestBody LoginRequest r) {
        return response(auth.login(r.login(), r.password(), Role.EMPLOYEE));
    }

    @GetMapping("/auth/demo-profiles")
    public List<DemoSeed.DemoProfile> demoProfiles() { return seed.demoProfiles(); }

    @PostMapping("/auth/demo-login")
    public LoginResponse demoLogin(@RequestBody DemoLoginRequest r) {
        String login = seed.demoProfiles().stream().filter(p -> p.id().equals(r.profileId()))
                .map(DemoSeed.DemoProfile::login).findFirst()
                .orElseThrow(() -> ru.creditcabinet.backend.common.ApiException.notFound("Демопрофиль не найден"));
        return response(auth.loginDemoProfile(login));
    }

    @PostMapping("/auth/logout")
    public void logout(@RequestHeader(value = "Authorization", required = false) String header) {
        if (header != null && header.startsWith("Bearer ")) auth.logout(WebConfig.bearerToken(header));
    }

    @GetMapping("/me")
    public Principal me(Principal p) { return p; }

    @GetMapping("/profile")
    public ProfileService.CompanyProfile profile(Principal p) { return profiles.profile(p); }

    private LoginResponse response(String token) {
        Principal p = auth.authenticate(token);
        return new LoginResponse(token, p.role(), p.fullName(), p.companyInn());
    }
}
