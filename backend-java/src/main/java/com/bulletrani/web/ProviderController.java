package com.bulletrani.web;

import com.bulletrani.provider.ProviderWalletService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thin REST helpers so the game UI can sync Provider wallet balance/profile
 * when launched with ?sessionToken=...
 */
@RestController
@RequestMapping("/api/provider")
public class ProviderController {
  private final ProviderWalletService provider;

  public ProviderController(ProviderWalletService provider) {
    this.provider = provider;
  }

  @GetMapping("/status")
  public Map<String, Object> status() {
    return provider.getPublicConfig();
  }

  @PostMapping("/balance")
  public ResponseEntity<?> balance(@RequestBody Map<String, String> body) {
    String token = body.getOrDefault("token", body.get("sessionToken"));
    String partnerCode = body.getOrDefault("partner_code", body.get("partnerCode"));
    if (partnerCode != null && !partnerCode.isBlank() && provider.isOperationsWalletConfigured()) {
      try {
        Double bal = provider.operationsBalance(token, partnerCode);
        return ResponseEntity.ok(Map.of("success", true, "balance", bal));
      } catch (Exception e) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
      }
    }
    if (!provider.isEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Provider wallet disabled"));
    }
    try {
      Double bal = provider.getBalance(token);
      return ResponseEntity.ok(Map.of("success", true, "balance", bal));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
    }
  }

  @PostMapping("/credit-transfer")
  public ResponseEntity<?> creditTransfer(@RequestBody Map<String, Object> body) {
    if (!provider.isOperationsWalletConfigured()) {
      return ResponseEntity.badRequest().body(Map.of("success", false, "error", "INTERNAL_SERVICE_KEY not configured"));
    }
    String token = String.valueOf(body.getOrDefault("token", body.getOrDefault("sessionToken", "")));
    String partnerCode = String.valueOf(body.getOrDefault("partner_code", body.getOrDefault("partnerCode", "")));
    long gid = Long.parseLong(String.valueOf(body.getOrDefault("gid", "0")));
    double bet = Double.parseDouble(String.valueOf(body.getOrDefault("bet", "0")));
    double win = Double.parseDouble(String.valueOf(body.getOrDefault("win", "0")));
    String gameType = String.valueOf(body.getOrDefault("game_type", "spin"));
    String tranId = String.valueOf(body.getOrDefault("tranid", ""));
    int ttype = Integer.parseInt(String.valueOf(body.getOrDefault("ttype", "refund".equalsIgnoreCase(gameType) ? "2" : "1")));
    String roundId = String.valueOf(body.getOrDefault("roundid", ""));

    Map<String, Object> res = provider.operationsCreditTransfer(
        token, partnerCode, gid, bet, win, gameType, tranId, ttype, roundId);
    return Boolean.TRUE.equals(res.get("success"))
        ? ResponseEntity.ok(res)
        : ResponseEntity.badRequest().body(res);
  }

  @PostMapping("/profile")
  public ResponseEntity<?> profile(@RequestBody Map<String, String> body) {
    if (!provider.isEnabled()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Provider wallet disabled"));
    }
    try {
      return ResponseEntity.ok(Map.of("success", true, "profile", provider.getPlayerProfile(body.get("sessionToken"))));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
    }
  }
}
