package com.bulletrani.web;

import com.bulletrani.provider.ProviderWalletService;
import com.bulletrani.security.JwtService;
import com.bulletrani.store.DataStore;
import com.bulletrani.store.Models.User;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST helpers so the game client forwards launch parameters to the backend
 * (never calling Operations /api/v1/wallet/* directly from the browser).
 */
@RestController
@RequestMapping("/api/provider")
public class ProviderController {
  private final ProviderWalletService provider;
  private final DataStore db;
  private final JwtService jwt;

  public ProviderController(ProviderWalletService provider, DataStore db, JwtService jwt) {
    this.provider = provider;
    this.db = db;
    this.jwt = jwt;
  }

  @GetMapping("/status")
  public Map<String, Object> status() {
    return provider.getPublicConfig();
  }

  /** Launch & Boot: validate launch token via 2051 wallet/balance (server-to-server) and issue game JWT. */
  @PostMapping("/boot")
  public ResponseEntity<?> boot(@RequestBody Map<String, Object> body) {
    String token = str(body.get("token"));
    if (token.isBlank()) token = str(body.get("sessionToken"));
    String partnerCode = str(body.get("partner_code"));
    if (partnerCode.isBlank()) partnerCode = str(body.get("partnerCode"));
    String gid = str(body.get("gid"));
    String gameCode = str(body.get("game_code"));
    if (gameCode.isBlank()) gameCode = str(body.get("gameCode"));
    String username = str(body.get("username"));
    String externalUserId = str(body.get("user_id"));
    String currency = str(body.get("currency"));
    if (currency.isBlank()) currency = "INR";
    String lang = str(body.get("lang"));
    if (lang.isBlank()) lang = "en";

    if (token.isBlank() || partnerCode.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of(
          "success", false,
          "error", "token and partner_code are required"));
    }

    Double balance = null;
    if (provider.isOperationsWalletConfigured()) {
      try {
        balance = provider.operationsBalance(token, partnerCode);
      } catch (Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : "Session validation failed";
        String upper = msg.toUpperCase();
        boolean expired = upper.contains("ERR-0011") || upper.contains("ERR-0012") || upper.contains("ERR-0013")
            || upper.contains("401") || upper.contains("403");
        return ResponseEntity.status(expired ? 401 : 400).body(Map.of(
            "success", false,
            "sessionExpired", expired,
            "error", msg));
      }
    }

    User user = db.findOrCreateProviderUser(partnerCode, externalUserId, username);
    if (balance != null) {
      db.updateBalance(user.id, balance);
      user.balance = balance;
    }

    Map<String, Object> userDto = new LinkedHashMap<>();
    userDto.put("id", user.id);
    userDto.put("username", user.username);
    userDto.put("balance", user.balance);
    userDto.put("role", user.role);
    userDto.put("currency", currency);
    userDto.put("lang", lang);
    userDto.put("partnerCode", partnerCode);
    userDto.put("gid", gid);
    userDto.put("gameCode", gameCode);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("token", jwt.issue(user));
    out.put("balance", user.balance);
    out.put("user", userDto);
    return ResponseEntity.ok(out);
  }

  private static String str(Object v) {
    if (v == null) return "";
    String s = String.valueOf(v).trim();
    return "null".equalsIgnoreCase(s) ? "" : s;
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
