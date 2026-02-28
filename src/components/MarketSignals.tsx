/**
 * MarketSignals — AI-generated tweet-style feed from live market data.
 *
 * Displays stock-bro commentary from five fictional analyst personas,
 * driven by real currency sparkline and volume data from poe.ninja.
 * Port of the desktop dashboard MarketSignals component.
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Colors } from "../theme";
import type { CurrencyLine, RateSnapshot } from "../types";

// ─── Analyst Personas ──────────────────────────────────────────

interface Analyst {
  handle: string;
  name: string;
  emoji: string;
  avatar: string;
  color: string;
  style: string;
}

const ANALYSTS: Analyst[] = [
  { handle: "@DivineWhale", name: "Divine Whale", emoji: "\u{1F40B}", avatar: "DW", color: "#6b8fff", style: "bullish" },
  { handle: "@ChaosGoblin", name: "Chaos Goblin", emoji: "\u{1F47A}", avatar: "CG", color: "#4ade80", style: "contrarian" },
  { handle: "@MarketMonkey", name: "Market Monkey", emoji: "\u{1F412}", avatar: "MM", color: "#c4a456", style: "hype" },
  { handle: "@ExaltedElk", name: "Exalted Elk", emoji: "\u{1F98C}", avatar: "EE", color: "#c084fc", style: "analytical" },
  { handle: "@OmenOracle", name: "Omen Oracle", emoji: "\u{1F52E}", avatar: "OO", color: "#f59e0b", style: "mystical" },
];

// ─── Helpers ───────────────────────────────────────────────────

function hashStr(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fakeTimeAgo(index: number, seed: number): string {
  const mins = [2, 5, 7, 12, 18, 23, 31, 42, 55, 68, 84, 97];
  const m = mins[(index + seed) % mins.length];
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

// ─── Signal Types ──────────────────────────────────────────────

interface Signal {
  type: string;
  currency: string;
  change: number;
  value: number;
  volume: number;
  priority: number;
  extra?: Record<string, unknown>;
  _d2c?: number;
  text?: string;
}

function generateSignals(
  lines: CurrencyLine[],
  rateHistory: RateSnapshot[],
): Signal[] {
  if (!lines || lines.length === 0) return [];
  const signals: Signal[] = [];

  const withChange = lines.filter((c) => c.sparkline_change != null);
  const sorted = [...withChange].sort(
    (a, b) => Math.abs(b.sparkline_change) - Math.abs(a.sparkline_change),
  );
  const topByValue = [...lines]
    .sort((a, b) => (b.divine_value || 0) - (a.divine_value || 0))
    .slice(0, 3);
  const topValueNames = new Set(topByValue.map((c) => c.name));

  for (const cur of withChange) {
    const ch = cur.sparkline_change;
    if (ch >= 15) {
      signals.push({ type: "big_mover_up", currency: cur.name, change: ch, value: cur.divine_value, volume: cur.volume || 0, priority: Math.abs(ch) * 2 });
    } else if (ch <= -15) {
      signals.push({ type: "big_mover_down", currency: cur.name, change: ch, value: cur.divine_value, volume: cur.volume || 0, priority: Math.abs(ch) * 2 });
    } else if (Math.abs(ch) >= 5) {
      signals.push({ type: "moderate_mover", currency: cur.name, change: ch, value: cur.divine_value, volume: cur.volume || 0, priority: Math.abs(ch) });
    }
  }

  // Volume spikes (not top-3 by value)
  for (const cur of lines) {
    if ((cur.volume || 0) >= 2000 && !topValueNames.has(cur.name)) {
      signals.push({ type: "volume_spike", currency: cur.name, change: cur.sparkline_change || 0, value: cur.divine_value, volume: cur.volume, priority: cur.volume / 500 });
    }
  }

  // Ratio shift from rate history
  if (rateHistory && rateHistory.length >= 2) {
    const first = rateHistory[0];
    const last = rateHistory[rateHistory.length - 1];
    const firstRatio = first.divine_to_chaos || 0;
    const lastRatio = last.divine_to_chaos || 0;
    if (firstRatio > 0) {
      const ratioChange = ((lastRatio - firstRatio) / firstRatio) * 100;
      if (Math.abs(ratioChange) > 2) {
        signals.push({ type: "ratio_shift", currency: "Divine Orb", change: ratioChange, value: lastRatio, volume: 0, priority: Math.abs(ratioChange) * 3, extra: { oldRatio: firstRatio, newRatio: lastRatio } });
      }
    }
  }

  // Whale alert
  for (const cur of lines) {
    if ((cur.divine_value || 0) > 50 && (cur.volume || 0) > 500) {
      signals.push({ type: "whale_alert", currency: cur.name, change: cur.sparkline_change || 0, value: cur.divine_value, volume: cur.volume, priority: cur.divine_value / 10 });
    }
  }

  // Contrarian take on biggest mover
  if (sorted.length > 0) {
    const biggest = sorted[0];
    signals.push({ type: "contrarian", currency: biggest.name, change: biggest.sparkline_change, value: biggest.divine_value, volume: biggest.volume || 0, priority: 5 });
  }

  // Overall sentiment
  const upCount = withChange.filter((c) => c.sparkline_change > 0).length;
  const downCount = withChange.filter((c) => c.sparkline_change < 0).length;
  signals.push({ type: "sentiment", currency: "", change: 0, value: 0, volume: 0, priority: 4, extra: { up: upCount, down: downCount, total: withChange.length } });

  signals.sort((a, b) => b.priority - a.priority);
  return signals.slice(0, 7);
}

// ─── Tweet Templates ───────────────────────────────────────────

const TWEET_TEMPLATES: Record<string, Array<(s: Signal) => string>> = {
  big_mover_up: [
    (s) => `{${s.currency}} absolutely RIPPING today, up ${Math.abs(s.change).toFixed(1)}% on the week. This is what we call a breakout. Not selling a single one.`,
    (s) => `Been telling you about {${s.currency}} for weeks. +${Math.abs(s.change).toFixed(1)}% and we're just getting started. Patience pays.`,
    (s) => `{${s.currency}} pumping ${Math.abs(s.change).toFixed(1)}% while everyone sleeps. Early birds eating GOOD right now.`,
    (s) => `The charts on {${s.currency}} are textbook. +${Math.abs(s.change).toFixed(1)}% breakout with volume backing it. This is the move.`,
  ],
  big_mover_down: [
    (s) => `{${s.currency}} drilling ${Math.abs(s.change).toFixed(1)}% into the earth's core. Blood in the streets or buying opportunity? I know which one I'm picking.`,
    (s) => `Massive dump on {${s.currency}}, down ${Math.abs(s.change).toFixed(1)}%. Weak hands getting shaken out. Smart money is accumulating.`,
    (s) => `{${s.currency}} in freefall \u2014 ${Math.abs(s.change).toFixed(1)}% down. If you're not buying this dip you'll regret it next week.`,
  ],
  moderate_mover: [
    (s) => `{${s.currency}} quietly moving ${s.change > 0 ? "up" : "down"} ${Math.abs(s.change).toFixed(1)}%. Not flashy but worth watching. Currently at ${s.value >= 1 ? s.value.toFixed(1) + "d" : Math.round(s.value * (s._d2c || 100)) + "c"}.`,
    (s) => `Seeing some ${s.change > 0 ? "bullish" : "bearish"} action on {${s.currency}} \u2014 ${s.change > 0 ? "+" : ""}${s.change.toFixed(1)}% this week. The trend is your friend.`,
    (s) => `{${s.currency}} ${s.change > 0 ? "grinding higher" : "sliding lower"}, ${s.change > 0 ? "+" : ""}${s.change.toFixed(1)}%. Keep this on your watchlist.`,
  ],
  volume_spike: [
    (s) => `Volume alert on {${s.currency}} \u2014 ${fmtVol(s.volume)} trades recorded. Something is brewing. Smart money moving before the crowd.`,
    (s) => `Unusual volume on {${s.currency}} (${fmtVol(s.volume)} trades). When volume leads, price follows. Just saying.`,
    (s) => `{${s.currency}} volume through the roof at ${fmtVol(s.volume)}. Somebody knows something we don't.`,
  ],
  ratio_shift: [
    (s) => `Divine:Chaos ratio shifting ${s.change > 0 ? "up" : "down"} ${Math.abs(s.change).toFixed(1)}%. Was ${Math.round(s.extra?.oldRatio as number)}c, now ${Math.round(s.extra?.newRatio as number)}c. The macro is moving.`,
    (s) => `Big macro move \u2014 Divine Orb ${s.change > 0 ? "strengthening" : "weakening"} against Chaos, ratio ${s.change > 0 ? "up" : "down"} ${Math.abs(s.change).toFixed(1)}%. This changes everything.`,
    (s) => `The Divine:Chaos spread is ${s.change > 0 ? "widening" : "tightening"}. ${Math.abs(s.change).toFixed(1)}% shift. Adjust your pricing accordingly.`,
  ],
  whale_alert: [
    (s) => `Whale activity detected on {${s.currency}} \u2014 ${s.value.toFixed(1)}d per unit with ${fmtVol(s.volume)} volume. Big players are in this market.`,
    (s) => `{${s.currency}} at ${s.value.toFixed(1)}d with massive ${fmtVol(s.volume)} volume. This is whale territory. Retail follows.`,
    (s) => `High-value alert: {${s.currency}} trading at ${s.value.toFixed(1)} divines with serious volume. The whales are positioning.`,
  ],
  contrarian: [
    (s) => `Everyone's panicking about {${s.currency}} ${s.change > 0 ? "pumping" : "dumping"} ${Math.abs(s.change).toFixed(1)}%. Contrarian take: ${s.change > 0 ? "this is the top, take profits" : "this is the bottom, back up the truck"}.`,
    (s) => `{${s.currency}} ${s.change > 0 ? "up" : "down"} ${Math.abs(s.change).toFixed(1)}% and the herd is ${s.change > 0 ? "euphoric" : "in despair"}. You know what that means. ${s.change > 0 ? "Time to sell" : "Time to buy"}.`,
    (s) => `Hot take: {${s.currency}} at ${s.change > 0 ? "+" : ""}${s.change.toFixed(1)}% is ${s.change > 0 ? "overextended" : "oversold"}. The crowd is always wrong at extremes.`,
  ],
  sentiment: [
    (s) => `Market pulse: ${(s.extra as Record<string, number>).up} currencies green, ${(s.extra as Record<string, number>).down} red out of ${(s.extra as Record<string, number>).total} tracked. ${(s.extra as Record<string, number>).up > (s.extra as Record<string, number>).down ? "Bulls in control" : (s.extra as Record<string, number>).down > (s.extra as Record<string, number>).up ? "Bears feasting" : "Dead even"}. Trade accordingly.`,
    (s) => `Daily read: ${(s.extra as Record<string, number>).up}/${(s.extra as Record<string, number>).total} markets trending up, ${(s.extra as Record<string, number>).down} trending down. ${(s.extra as Record<string, number>).up > (s.extra as Record<string, number>).down ? "Risk-on environment" : "Defensive positioning advised"}.`,
    (s) => `Scanning ${(s.extra as Record<string, number>).total} currencies \u2014 ${(s.extra as Record<string, number>).up} rising, ${(s.extra as Record<string, number>).down} falling. The market ${(s.extra as Record<string, number>).up > (s.extra as Record<string, number>).down ? "wants to go higher" : (s.extra as Record<string, number>).down > (s.extra as Record<string, number>).up ? "is under pressure" : "can't make up its mind"}.`,
  ],
};

function fmtVol(v: number): string {
  return v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v).toString();
}

// ─── Tweet Text Renderer ───────────────────────────────────────

function TweetText({ text }: { text: string }) {
  const parts = text.split(/\{([^}]+)\}/g);
  return (
    <Text style={styles.tweetBody}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.goldHighlight}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

// ─── Tweet Card ────────────────────────────────────────────────

interface TweetData {
  signal: Signal & { text: string };
  analyst: Analyst;
  timeAgo: string;
}

function TweetCard({ tweet, isLast }: { tweet: TweetData; isLast: boolean }) {
  const { signal, analyst, timeAgo } = tweet;
  return (
    <View style={[styles.tweetRow, !isLast && styles.tweetBorder]}>
      {/* Avatar */}
      <View style={[styles.avatar, { borderColor: analyst.color, backgroundColor: analyst.color + "18" }]}>
        <Text style={[styles.avatarText, { color: analyst.color }]}>{analyst.avatar}</Text>
      </View>
      {/* Content */}
      <View style={styles.tweetContent}>
        <View style={styles.tweetHeader}>
          <Text style={styles.analystName}>{analyst.name} {analyst.emoji}</Text>
          <Text style={styles.analystHandle}>{analyst.handle}</Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
        <TweetText text={signal.text} />
      </View>
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────

interface MarketSignalsProps {
  lines: CurrencyLine[];
  rateHistory: RateSnapshot[];
  divineToChaos: number;
}

export default function MarketSignals({ lines, rateHistory, divineToChaos }: MarketSignalsProps) {
  const tweets = useMemo(() => {
    if (!lines || lines.length === 0) return [];
    const signals = generateSignals(lines, rateHistory);
    return signals
      .map((sig, i) => {
        const seed = hashStr(sig.type + sig.currency);
        const analyst = ANALYSTS[seed % ANALYSTS.length];
        const templates = TWEET_TEMPLATES[sig.type];
        if (!templates || templates.length === 0) return null;
        const tpl = templates[seed % templates.length];
        sig._d2c = divineToChaos;
        const text = tpl(sig);
        const timeAgo = fakeTimeAgo(i, seed);
        return { signal: { ...sig, text }, analyst, timeAgo } as TweetData;
      })
      .filter(Boolean) as TweetData[];
  }, [lines, rateHistory, divineToChaos]);

  if (tweets.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>MARKET SIGNALS</Text>
        <Text style={styles.headerSub}>AI-generated from live data</Text>
      </View>
      {/* Feed */}
      <ScrollView style={styles.feed} nestedScrollEnabled>
        {tweets.map((t, i) => (
          <TweetCard key={i} tweet={t} isLast={i === tweets.length - 1} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerSub: {
    fontSize: 8,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  feed: {
    maxHeight: 380,
  },

  // Tweet card
  tweetRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  tweetBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  tweetContent: {
    flex: 1,
  },
  tweetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  analystName: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text,
  },
  analystHandle: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  timeAgo: {
    fontSize: 9,
    color: Colors.textMuted,
    marginLeft: "auto",
  },
  tweetBody: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  goldHighlight: {
    color: Colors.gold,
    fontWeight: "700",
  },
});
