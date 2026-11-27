package com.bulletrani.provider;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.bulletrani.config.AppProperties;
import com.bulletrani.store.DataStore;
import in.oreng.gamesdk.ProviderGameServerSDK;
import in.oreng.gamesdk.ProviderSDKException;
import in.oreng.gamesdk.WalletOperationRequest;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ProviderWalletService {
  private final AppProperties props;
  private final DataStore db;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private volatile ProviderGameServerSDK sdk;

  public ProviderWalletService(AppProperties props, DataStore db) {
    this.props = props;
    this.db = db;
  }

  @PostConstruct
  public void loadPersisted() {
    AppProperties.Provider p = props.getProvider();
    String enabled = db.getSetting("provider_enabled", null);
    if (enabled != null) p.setEnabled("true".equalsIgnoreCase(enabled) || "1".equals(enabled));
    String apiUrl = db.getSetting("provider_api_url", null);
    if (apiUrl != null && !apiUrl.isBlank()) p.setApiUrl(apiUrl.trim());
    String apiKey = db.getSetting("provider_api_key", null);
    if (apiKey != null && !apiKey.isBlank()) p.setApiKey(apiKey.trim());
    String tableId = db.getSetting("provider_table_id", null);
    if (tableId != null && !tableId.isBlank()) p.setTableId(tableId.trim());
    String gameCode = db.getSetting("provider_game_code", null);
    if (gameCode != null && !gameCode.isBlank()) p.setGameCode(gameCode.trim());
    resetSdk();
  }

  public boolean isEnabled() {
    AppProperties.Provider p = props.getProvider();
    return p.isEnabled() && p.getApiKey() != null && !p.getApiKey().isBlank();
  }

  public String tableId() {
    return props.getProvider().getTableId();
  }

  public String gameCode() {
    return props.getProvider().getGameCode();
  }

  /** Stable id for finance grouping — derived from gateway host (e.g. dpbossking). */
  public String providerId() {
    return idFromApiUrl(props.getProvider().getApiUrl());
  }

  public String providerDisplayName() {
    String id = providerId();
    if ("dpbossking".equalsIgnoreCase(id)) return "dpbossking";
    return id;
  }

  /** Public status + masked credentials for admin / UI. */
  public Map<String, Object> getPublicConfig() {
    AppProperties.Provider p = props.getProvider();
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", providerId());
    m.put("name", providerDisplayName());
    m.put("enabled", p.isEnabled());
    m.put("active", isEnabled());
    m.put("apiUrl", p.getApiUrl());
    m.put("apiKeyConfigured", p.getApiKey() != null && !p.getApiKey().isBlank());
    m.put("apiKeyMasked", maskKey(p.getApiKey()));
    m.put("tableId", p.getTableId());
    m.put("gameCode", p.getGameCode());
    m.put("walletMode", isEnabled() ? "provider" : "local");
    return m;
  }

  static String idFromApiUrl(String apiUrl) {
    if (apiUrl == null || apiUrl.isBlank()) return "provider";
    try {
      String host = java.net.URI.create(apiUrl.trim()).getHost();
      if (host == null || host.isBlank()) return "provider";
      host = host.toLowerCase();
      if (host.startsWith("api.")) host = host.substring(4);
      int dot = host.indexOf('.');
      return dot > 0 ? host.substring(0, dot) : host;
    } catch (Exception e) {
      return "provider";
    }
  }

  /**
   * Update Provider integration from admin panel. Empty apiKey keeps the existing secret.
   */
  public synchronized Map<String, Object> updateConfig(Map<String, Object> body) {
    AppProperties.Provider p = props.getProvider();

    if (body.containsKey("enabled")) {
      p.setEnabled(asBool(body.get("enabled")));
    }
    if (body.containsKey("apiUrl")) {
      String url = String.valueOf(body.get("apiUrl")).trim();
      if (!url.isEmpty()) p.setApiUrl(url.replaceAll("/+$", ""));
    }
    if (body.containsKey("apiKey")) {
      String key = String.valueOf(body.get("apiKey")).trim();
      // Ignore masked placeholders / blanks so admins can save other fields without re-entering secret
      if (!key.isEmpty() && !key.contains("•") && !key.contains("*")) {
        p.setApiKey(key);
      }
    }
    if (body.containsKey("tableId")) {
      String tid = String.valueOf(body.get("tableId")).trim();
      if (!tid.isEmpty()) p.setTableId(tid);
    }
    if (body.containsKey("gameCode")) {
      String code = String.valueOf(body.get("gameCode")).trim().toUpperCase();
      if (!code.isEmpty()) p.setGameCode(code);
    }

    db.putSettings(Map.of(
        "provider_enabled", String.valueOf(p.isEnabled()),
        "provider_api_url", nullToEmpty(p.getApiUrl()),
        "provider_api_key", nullToEmpty(p.getApiKey()),
        "provider_table_id", nullToEmpty(p.getTableId()),
        "provider_game_code", nullToEmpty(p.getGameCode())
    ));

    resetSdk();
    return getPublicConfig();
  }

  private void resetSdk() {
    sdk = null;
  }

  private ProviderGameServerSDK sdk() {
    if (!isEnabled()) {
      throw new IllegalStateException("Provider wallet is not enabled");
    }
    if (sdk == null) {
      synchronized (this) {
        if (sdk == null) {
          sdk = new ProviderGameServerSDK(props.getProvider().getApiUrl(), props.getProvider().getApiKey());
        }
      }
    }
    return sdk;
  }

  public boolean isOperationsWalletConfigured() {
    String u = props.getProvider().getOperationsUrl();
    String k = props.getProvider().getInternalKey();
    return u != null && !u.isBlank() && k != null && !k.isBlank();
  }

  /** Operations opType 2051: POST /api/v1/wallet/balance */
  public Double operationsBalance(String token, String partnerCode) throws Exception {
    JsonObject body = new JsonObject();
    body.addProperty("token", token);
    body.addProperty("partner_code", partnerCode);
    JsonObject res = postOperations("/api/v1/wallet/balance", body);
    if (res.has("status") && !res.get("status").getAsBoolean()) {
      throw new IllegalStateException(res.has("message") ? res.get("message").getAsString() : "Balance fetch failed");
    }
    Double bal = readAmount(res);
    if (bal == null && res.has("message") && !res.get("message").isJsonNull()) {
      try { bal = res.get("message").getAsDouble(); } catch (Exception ignored) {}
    }
    return bal;
  }

  /** Operations opType 2052: POST /api/v1/wallet/credit-transfer (idempotent retries on timeout/502). */
  public Map<String, Object> operationsCreditTransfer(
      String token, String partnerCode, long gid, double bet, double win,
      String gameType, String tranId, int ttype, String roundId) {
    return operationsCreditTransfer(token, partnerCode, null, gid, bet, win, gameType, tranId, ttype, roundId);
  }

  public Map<String, Object> operationsCreditTransfer(
      String token, String partnerCode, String userId, long gid, double bet, double win,
      String gameType, String tranId, int ttype, String roundId) {
    try {
      JsonObject body = new JsonObject();
      if (token != null && !token.isBlank()) body.addProperty("token", token);
      if (partnerCode != null && !partnerCode.isBlank()) body.addProperty("partner_code", partnerCode);
      if (userId != null && !userId.isBlank()) body.addProperty("user_id", userId);
      body.addProperty("gid", gid);
      body.addProperty("bet", bet);
      body.addProperty("win", win);
      body.addProperty("game_type", gameType != null && !gameType.isBlank() ? gameType : "spin");
      body.addProperty("tranid", tranId);
      body.addProperty("ttype", ttype);
      body.addProperty("roundid", roundId);

      JsonObject res = postOperations("/api/v1/wallet/credit-transfer", body);
      boolean ok = res.has("status") && res.get("status").getAsBoolean();
      Double bal = readAmount(res);
      if (bal == null && ok && res.has("message") && !res.get("message").isJsonNull()) {
        try { bal = res.get("message").getAsDouble(); } catch (Exception ignored) {}
      }
      String msg = !ok && res.has("message") && !res.get("message").isJsonNull()
          ? res.get("message").getAsString() : null;
      String code = res.has("code") && !res.get("code").isJsonNull()
          ? res.get("code").getAsString() : null;

      Map<String, Object> out = new LinkedHashMap<>();
      out.put("success", ok);
      if (bal != null) out.put("balance", bal);
      if (msg != null) out.put("message", msg);
      if (code != null) out.put("code", code);
      if (isSessionExpiredError(code, msg)) out.put("sessionExpired", true);
      out.put("raw", res.toString());
      return out;
    } catch (Exception e) {
      Map<String, Object> fail = new LinkedHashMap<>();
      fail.put("success", false);
      fail.put("message", e.getMessage());
      return fail;
    }
  }

  /** Aborted-round refund (game_type: "refund", ttype: 2, unique refund tranid). */
  public Map<String, Object> operationsRefund(
      String token, String partnerCode, long gid, double bet, String roundId, String tranId) {
    String refundTranId = (tranId != null && !tranId.isBlank())
        ? tranId
        : (gid + "-" + roundId + "-refund-" + UUID.randomUUID().toString().substring(0, 8));
    return operationsCreditTransfer(token, partnerCode, null, gid, bet, 0, "refund", refundTranId, 2, roundId);
  }

  private static boolean isSessionExpiredError(String code, String msg) {
    String combined = ((code != null ? code : "") + " " + (msg != null ? msg : "")).toUpperCase();
    return combined.contains("ERR-0011") || combined.contains("ERR-0012") || combined.contains("ERR-0013");
  }

  private JsonObject postOperations(String path, JsonObject payload) throws Exception {
    String rawUrl = props.getProvider().getOperationsUrl();
    if (rawUrl == null || rawUrl.isBlank()) {
      throw new IllegalStateException("OPERATIONS_API_URL is not configured");
    }
    String base = rawUrl.replaceAll("/+$", "");
    String internalKey = props.getProvider().getInternalKey();
    if (internalKey == null || internalKey.isBlank()) {
      throw new IllegalStateException("INTERNAL_SERVICE_KEY is not configured");
    }
    HttpRequest req = HttpRequest.newBuilder()
        .uri(URI.create(base + path))
        .timeout(Duration.ofSeconds(15))
        .header("Content-Type", "application/json")
        .header("X-Internal-Key", internalKey)
        .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
        .build();

    // Retry up to 3 times on network timeout / 502 / 503 / 504 using the exact same payload & tranid
    Exception lastErr = null;
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        int status = resp.statusCode();
        if (status == 502 || status == 503 || status == 504) {
          lastErr = new IllegalStateException("Operations HTTP " + status + ": " + resp.body());
        } else if (status == 400) {
          // Operator business refusal (status: false) — parse and return without retrying
          return JsonParser.parseString(resp.body()).getAsJsonObject();
        } else if (status >= 400) {
          throw new IllegalStateException("Operations HTTP " + status + ": " + resp.body());
        } else {
          return JsonParser.parseString(resp.body()).getAsJsonObject();
        }
      } catch (java.io.IOException e) {
        lastErr = e;
      }
      if (attempt < 2) {
        Thread.sleep(500L * (attempt + 1));
      }
    }
    throw lastErr != null ? lastErr : new IllegalStateException("Operations request failed");
  }

  public Double getBalance(String sessionToken) {
    JsonObject data = sdk().getBalance(sessionToken);
    return readAmount(data);
  }

  public Map<String, Object> getPlayerProfile(String sessionToken) {
    JsonObject data = sdk().getPlayerProfile(sessionToken);
    Map<String, Object> out = new LinkedHashMap<>();
    data.entrySet().forEach(e -> out.put(e.getKey(), jsonToJava(e.getValue())));
    return out;
  }

  public Map<String, Object> debit(String sessionToken, double amount, String transactionId,
                                  String roundId, String tableId) {
    try {
      JsonObject data = sdk().debit(WalletOperationRequest.builder()
          .sessionToken(sessionToken)
          .amount(amount)
          .transactionId(transactionId)
          .roundId(roundId)
          .tableId(tableId != null ? tableId : tableId())
          .build());
      return Map.of(
          "success", true,
          "balance", readAmount(data),
          "raw", data.toString()
      );
    } catch (ProviderSDKException e) {
      Map<String, Object> fail = new LinkedHashMap<>();
      fail.put("success", false);
      fail.put("message", e.getMessage());
      fail.put("status", e.getStatus());
      return fail;
    }
  }

  public Map<String, Object> credit(String sessionToken, double amount, String transactionId,
                                   String roundId, String tableId) {
    try {
      JsonObject data = sdk().credit(WalletOperationRequest.builder()
          .sessionToken(sessionToken)
          .amount(amount)
          .transactionId(transactionId)
          .roundId(roundId)
          .tableId(tableId != null ? tableId : tableId())
          .build());
      return Map.of(
          "success", true,
          "balance", readAmount(data),
          "raw", data.toString()
      );
    } catch (ProviderSDKException e) {
      Map<String, Object> fail = new LinkedHashMap<>();
      fail.put("success", false);
      fail.put("message", e.getMessage());
      fail.put("status", e.getStatus());
      return fail;
    }
  }

  public static String newTxId(String prefix) {
    return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
  }

  private static String maskKey(String key) {
    if (key == null || key.isBlank()) return "";
    if (key.length() <= 8) return "••••••••";
    return key.substring(0, 4) + "••••" + key.substring(key.length() - 4);
  }

  private static boolean asBool(Object v) {
    if (v instanceof Boolean b) return b;
    String s = String.valueOf(v).trim().toLowerCase();
    return "true".equals(s) || "1".equals(s) || "yes".equals(s);
  }

  private static String nullToEmpty(String s) {
    return s == null ? "" : s;
  }

  private static Double readAmount(JsonObject data) {
    if (data == null) return null;
    for (String key : new String[]{"balance", "amount", "walletBalance", "value"}) {
      if (data.has(key) && !data.get(key).isJsonNull()) {
        try { return data.get(key).getAsDouble(); } catch (Exception ignored) {}
      }
    }
    return null;
  }

  private static Object jsonToJava(JsonElement el) {
    if (el == null || el.isJsonNull()) return null;
    if (el.isJsonPrimitive()) {
      if (el.getAsJsonPrimitive().isNumber()) return el.getAsNumber();
      if (el.getAsJsonPrimitive().isBoolean()) return el.getAsBoolean();
      return el.getAsString();
    }
    return el.toString();
  }
}
