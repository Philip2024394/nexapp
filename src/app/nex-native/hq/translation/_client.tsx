"use client";

// src/app/nex-native/hq/translation/_client.tsx
//
// HQ · Translation Monitoring · client view.
// Owner-authorised 2026-11-17 · local/sandbox only.
//
// This file renders the server-supplied snapshot. It never fetches
// customer text, never fires a provider request, and never logs a
// message body. Refresh pulls a new HQ-admin-gated snapshot through
// readHqTranslationSnapshotAction.

import * as React from "react";
import {
  readHqTranslationSnapshotAction,
  type HqTranslationSnapshotResult,
} from "./_actions";
import type {
  TranslationAvailabilityState,
  TranslationMonitoringSnapshot,
  TranslationProviderHealth,
} from "@/lib/nex-native/hq/translation-monitor";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "#071A12";
const SURFACE_HI = "#0B2A1C";
const ACCENT = "#16D66B";
const WARN = "#F6B01E";
const DANGER = "#E04A4A";
const NEUTRAL = "#7D9BC0";
const BORDER = "rgba(22,214,107,0.18)";
const BORDER_HI = "rgba(22,214,107,0.48)";

const AVAILABILITY_LABEL: Record<TranslationAvailabilityState, string> = {
  disabled: "Feature disabled",
  configuration_incomplete: "Configuration incomplete",
  configured_not_live_tested: "Configured · not live-tested",
  configured: "Configured · last live request succeeded",
  unknown: "Unknown",
};

const AVAILABILITY_COLOUR: Record<TranslationAvailabilityState, string> = {
  disabled: NEUTRAL,
  configuration_incomplete: WARN,
  configured_not_live_tested: WARN,
  configured: ACCENT,
  unknown: NEUTRAL,
};

const HEALTH_LABEL: Record<TranslationProviderHealth, string> = {
  unknown: "Unknown",
  no_observations: "No observations recorded",
  last_success: "Last provider request succeeded",
  degraded_last_failure: "Degraded · last provider request failed",
  rate_limited: "Rate limited by provider",
  quota_exhausted: "Quota exhausted (observed)",
  unavailable: "Provider reported unavailable",
};

const HEALTH_COLOUR: Record<TranslationProviderHealth, string> = {
  unknown: NEUTRAL,
  no_observations: NEUTRAL,
  last_success: ACCENT,
  degraded_last_failure: WARN,
  rate_limited: WARN,
  quota_exhausted: DANGER,
  unavailable: DANGER,
};

export function HqTranslationMonitoringClient({
  snapshot: initial,
}: {
  readonly snapshot: TranslationMonitoringSnapshot;
}): React.ReactElement {
  const [snapshot, setSnapshot] = React.useState(initial);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const r: HqTranslationSnapshotResult = await readHqTranslationSnapshotAction();
      if (r.ok) setSnapshot(r.snapshot);
      else setRefreshError(r.reason === "not_hq_admin" ? "HQ admin required" : "Not signed in");
    } catch {
      setRefreshError("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.18em" }}>
            HQ · Translation Monitoring
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: "6px 0 10px", letterSpacing: "0.01em" }}>
            Chat Translation Pilot
          </h1>
          <p style={{ fontSize: 13.5, color: INK_DIM, lineHeight: 1.6, margin: 0, maxWidth: 820 }}>
            Operational overview for the founder-only chat-translation pilot. Every indicator is derived from
            environment configuration and process-local observations · no provider request is fired to paint
            this page. Preferences (reading language, per-conversation auto toggle, consent) live device-local;
            there is no server record of them.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh translation monitoring snapshot"
          style={{
            padding: "9px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            background: refreshing ? "rgba(22,214,107,0.12)" : ACCENT,
            color: refreshing ? INK_DIM : "#031309",
            border: `1px solid ${BORDER_HI}`,
            cursor: refreshing ? "default" : "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {refreshError ? (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", border: `1px solid ${DANGER}`, borderRadius: 10, background: "#2A0E0E", color: INK }}>
          {refreshError}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        <StatusTile
          label="Feature availability"
          valueLabel={AVAILABILITY_LABEL[snapshot.availability]}
          colour={AVAILABILITY_COLOUR[snapshot.availability]}
          caption={snapshot.featureFlagEnabled ? "NEX_CHAT_TRANSLATION_ENABLED=true" : "NEX_CHAT_TRANSLATION_ENABLED not true"}
        />
        <StatusTile
          label="Provider health"
          valueLabel={HEALTH_LABEL[snapshot.providerHealth]}
          colour={HEALTH_COLOUR[snapshot.providerHealth]}
          caption={snapshot.metrics.lastOutcomeAtIso ? `Last observation: ${snapshot.metrics.lastOutcomeAtIso}` : "No observations yet"}
        />
        <StatusTile
          label="Environment"
          valueLabel={snapshot.environment}
          colour={snapshot.environment === "sandbox" ? ACCENT : snapshot.environment === "local" ? NEUTRAL : WARN}
          caption="Derived from NEXT_PUBLIC_NEX_SUPABASE_URL · informational only"
        />
      </div>

      {snapshot.blockers.length > 0 ? (
        <section aria-label="Translation blockers" style={cardStyle()}>
          <h2 style={h2Style()}>Current blockers</h2>
          <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13.5, color: INK_DIM, lineHeight: 1.7 }}>
            {snapshot.blockers.map((b) => (
              <li key={b}>
                <code style={{ color: WARN }}>{b}</code>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 10, fontSize: 12.5, color: INK_MUTED, lineHeight: 1.6 }}>
            Blockers are evaluated against environment presence only. The HQ page cannot provision credentials, change
            tiers, or activate the live path.
          </p>
        </section>
      ) : null}

      <section aria-label="Pilot configuration" style={cardStyle()}>
        <h2 style={h2Style()}>Pilot configuration</h2>
        <KVGrid
          rows={[
            ["Provider", snapshot.provider.providerName],
            ["Feature flag variable", code(snapshot.provider.envVarNames.featureFlag)],
            ["Flag value", snapshot.featureFlagEnabled ? "true" : "not-true"],
            ["Credential variable · key", code(snapshot.provider.envVarNames.key) + (snapshot.provider.hasKey ? " · present" : " · missing")],
            ["Credential variable · region", code(snapshot.provider.envVarNames.region) + (snapshot.provider.hasRegion ? " · present" : " · missing")],
            ["Credential variable · endpoint", code(snapshot.provider.envVarNames.endpoint) + (snapshot.provider.hasEndpoint ? " · present" : " · missing")],
            ["Founder allowlist variable", code(snapshot.provider.envVarNames.founderAllowlist) + (snapshot.provider.founderAllowlistConfigured ? " · present" : " · missing")],
            ["Tier verified", snapshot.provider.tierVerified ? "yes" : "no"],
            ["Quota verified", snapshot.provider.quotaVerified ? "yes" : "no"],
            ["Supported languages", snapshot.pilotScope.supportedLanguageCodes.join(", ")],
            ["Automatic-translation default", snapshot.pilotScope.autoTranslateDefault],
            ["Max input chars / request", String(snapshot.pilotScope.maxInputChars)],
            ["Min chars for auto translate", String(snapshot.pilotScope.minAutoTranslateChars)],
            ["Request timeout (ms)", String(snapshot.pilotScope.timeoutMsDefault)],
            ["Retry policy", snapshot.pilotScope.retryPolicy],
            ["In-process rate limit", `${snapshot.pilotScope.rateLimitPerAccountPerMinute} req/account/min · ${snapshot.pilotScope.maxInFlightPerAccount} in-flight/account`],
            ["Rate-limit scope", snapshot.pilotScope.rateLimitScope + " · NOT cross-instance"],
            ["Preference persistence", snapshot.pilotScope.preferencePersistence],
          ]}
        />
        <p style={{ marginTop: 10, fontSize: 12.5, color: INK_MUTED, lineHeight: 1.6 }}>
          No credential value is read or rendered here · only whether each variable has any value. Tier and quota
          are marked unverified until the owner confirms the Azure resource tier out-of-band.
        </p>
      </section>

      <section aria-label="Usage metrics" style={cardStyle()}>
        <h2 style={h2Style()}>Usage metrics · honest definitions</h2>
        <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.65, marginTop: 0 }}>
          These counts reflect requests observed by <strong>THIS Node process only</strong>, since{" "}
          <code style={{ color: ACCENT }}>{snapshot.metrics.collectionStartIso}</code>. They are NOT
          durable, NOT deduplicated across processes, and NOT equal to Microsoft&rsquo;s billed usage. In a
          multi-instance deployment, each process has its own copy.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "10px 0" }}>
          <Metric label="Total requests observed" value={snapshot.metrics.totalRequests} />
          <Metric label="Provider attempts" value={snapshot.metrics.providerAttempts} />
          <Metric label="Provider successes" value={snapshot.metrics.providerSuccesses} />
          <Metric label="Provider failures" value={snapshot.metrics.providerFailures} />
          <Metric label="Provider timeouts" value={snapshot.metrics.providerTimeouts} />
          <Metric label="Provider rate-limited" value={snapshot.metrics.providerRateLimited} />
          <Metric label="Provider quota-exhausted" value={snapshot.metrics.providerQuotaExhausted} />
          <Metric
            label="Chars submitted (app estimate)"
            value={snapshot.metrics.charactersSubmittedEstimate}
            caption="NOT Microsoft's billed count"
          />
        </div>

        <h3 style={h3Style()}>Customer adoption</h3>
        <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.65 }}>
          Unique customers using translation: <strong>not collected</strong>. The pilot is founder-only and
          preference state lives device-local. A durable per-account count would require storage and retention
          approval that has NOT been requested in this pilot.
        </p>

        <h3 style={h3Style()}>Outcome breakdown</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          {Object.entries(snapshot.metrics.outcomeCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([outcome, count]) => (
              <div key={outcome} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12.5, color: INK_DIM }}>
                <code style={{ color: INK }}>{outcome}</code>
                <span>{count}</span>
              </div>
            ))}
        </div>

        <p style={{ marginTop: 10, fontSize: 12.5, color: INK_MUTED, lineHeight: 1.6 }}>
          All outcomes count a single service call · a provider retry inside the adapter is counted once by the
          service. &ldquo;Provider attempts&rdquo; = requests that reached the adapter after gates/validation
          passed. Rate-limit rejections never reach the provider.
        </p>
      </section>

      <section aria-label="Admin synthetic test" style={cardStyle()}>
        <h2 style={h2Style()}>Synthetic provider test</h2>
        <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.65, marginTop: 0 }}>
          A bounded admin-only synthetic test control is intentionally NOT exposed in this build. Firing a live
          request to paint a green indicator is not permitted · see the pilot report. The control will be enabled
          only when every prerequisite below is satisfied:
        </p>
        <PrerequisiteList
          items={[
            { label: "Founder allowlist configured", ok: snapshot.provider.founderAllowlistConfigured },
            { label: "Feature flag ON", ok: snapshot.featureFlagEnabled },
            { label: "AZURE_TRANSLATOR_KEY present", ok: snapshot.provider.hasKey },
            { label: "AZURE_TRANSLATOR_REGION present", ok: snapshot.provider.hasRegion },
            { label: "AZURE_TRANSLATOR_ENDPOINT present", ok: snapshot.provider.hasEndpoint },
            { label: "Tier verified by owner (manual)", ok: snapshot.provider.tierVerified },
            { label: "Pilot budget confirmed (manual)", ok: snapshot.provider.quotaVerified },
          ]}
        />
        <button
          type="button"
          disabled
          aria-disabled
          title="Disabled · prerequisites not satisfied"
          style={{
            marginTop: 10,
            padding: "9px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            background: "rgba(125,155,192,0.12)",
            color: INK_MUTED,
            border: `1px solid rgba(125,155,192,0.3)`,
            cursor: "not-allowed",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          Run synthetic test (disabled)
        </button>
      </section>

      <section aria-label="External processing disclosure" style={cardStyle()}>
        <h2 style={h2Style()}>External processing disclosure</h2>
        <KVGrid
          rows={[
            ["Provider", snapshot.externalProcessingDisclosure.provider],
            ["Data sent", snapshot.externalProcessingDisclosure.dataSent.replace(/_/g, " ")],
            ["Outgoing messages", snapshot.externalProcessingDisclosure.outgoingMessages.replace(/_/g, " ")],
            ["Vault content", snapshot.externalProcessingDisclosure.vaultContent],
            ["Credential logging", snapshot.externalProcessingDisclosure.credentialLogging.replace(/_/g, " ")],
          ]}
        />
      </section>

      <section aria-label="Resource links" style={cardStyle()}>
        <h2 style={h2Style()}>Resource links</h2>
        <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: INK_DIM, lineHeight: 1.7 }}>
          <li>
            <a
              href="https://portal.azure.com/"
              target="_blank"
              rel="noreferrer"
              style={{ color: ACCENT }}
            >
              Azure Portal
            </a>{" "}
            · official management · resource selection required after sign-in
          </li>
          <li>
            <a
              href="https://learn.microsoft.com/azure/ai-services/translator/text-translation-overview"
              target="_blank"
              rel="noreferrer"
              style={{ color: ACCENT }}
            >
              Azure AI Translator · Text Translation documentation
            </a>
          </li>
        </ul>
        <p style={{ marginTop: 8, fontSize: 12.5, color: INK_MUTED, lineHeight: 1.6 }}>
          External portal sign-in is managed by Microsoft · HQ does not grant Azure permissions. The founder must
          have their own Azure account access to inspect the resource.
        </p>
      </section>

      <footer style={{ marginTop: 20, fontSize: 11.5, color: INK_MUTED }}>
        Snapshot observed at <code style={{ color: ACCENT }}>{snapshot.observedAtIso}</code> ·
        counters are PROCESS-LOCAL and reset on restart · no customer PII is collected by this page.
      </footer>
    </div>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    marginBottom: 16,
    padding: "18px 20px",
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
  };
}

function h2Style(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 900, margin: "0 0 10px", color: INK };
}

function h3Style(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 800, margin: "12px 0 6px", color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.14em" };
}

function StatusTile({ label, valueLabel, colour, caption }: { label: string; valueLabel: string; colour: string; caption: string }): React.ReactElement {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, border: `1px solid ${BORDER}`, background: SURFACE }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: colour, boxShadow: `0 0 10px ${colour}` }} />
        <span style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>{valueLabel}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: INK_MUTED, lineHeight: 1.55 }}>{caption}</div>
    </div>
  );
}

function KVGrid({ rows }: { rows: ReadonlyArray<readonly [string, string]> }): React.ReactElement {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 14px", fontSize: 13 }}>
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <div style={{ color: INK_MUTED }}>{k}</div>
          <div style={{ color: INK_DIM, wordBreak: "break-word" }}>{v}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

function code(v: string): string {
  return v;
}

function Metric({ label, value, caption }: { label: string; value: number; caption?: string }): React.ReactElement {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE_HI }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, color: INK }}>{value}</div>
      {caption ? <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 2 }}>{caption}</div> : null}
    </div>
  );
}

function PrerequisiteList({ items }: { items: ReadonlyArray<{ label: string; ok: boolean }> }): React.ReactElement {
  return (
    <ul style={{ margin: "6px 0 0", padding: "0 0 0 18px", fontSize: 13, color: INK_DIM, lineHeight: 1.7 }}>
      {items.map((it) => (
        <li key={it.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ color: it.ok ? ACCENT : WARN, fontWeight: 900 }}>
            {it.ok ? "●" : "○"}
          </span>
          <span>{it.label}</span>
          <span style={{ marginLeft: 6, color: INK_MUTED, fontSize: 12 }}>{it.ok ? "· satisfied" : "· not satisfied"}</span>
        </li>
      ))}
    </ul>
  );
}
