import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { View, Text, TouchableHighlight, BackHandler, ActivityIndicator, HWEvent, useTVEventHandler } from "react-native";
import { useTranslation } from "react-i18next";
import { useKeepAwake } from "expo-keep-awake";
import LinearGradient from "react-native-linear-gradient";
import { CachedData, Colors, ScheduleClock, ScheduleSync, Styles, Typography } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { PlayerHelper } from "../helpers/PlayerHelper";
import { MessageFileInterface } from "../interfaces";
import { Message, PlayerErrorBoundary } from "../components";
import type { ScheduleSlot } from "../helpers/ScheduleClock";

type Props = { navigateTo(page: string, data?: any): void; };

const PANEL_SECONDS = 8;

const formatTime = (iso: string, timeZone?: string) => {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  try {
    return new Date(iso).toLocaleTimeString([], { ...options, timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString([], options);
  }
};

export const ScheduledPlayerScreen = (props: Props) => {
  useKeepAwake();
  const { t } = useTranslation();
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [slot, setSlot] = useState<ScheduleSlot>(() => ScheduleClock.resolve(ScheduleSync.manifest, Date.now()));
  const [index, setIndex] = useState(-1);
  const [cycle, setCycle] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [focused, setFocused] = useState("pin");

  const slotRef = useRef(slot);
  const indexRef = useRef(index);
  const pinnedRef = useRef(pinned);
  const finishedRef = useRef<string | null>(null);
  const panelVisibleRef = useRef(false);
  const panelTimer = useRef<NodeJS.Timeout | null>(null);
  const slideTimer = useRef<NodeJS.Timeout | null>(null);
  slotRef.current = slot;
  indexRef.current = index;
  pinnedRef.current = pinned;
  panelVisibleRef.current = panelVisible;

  const playable = (items = slotRef.current.items) => items.map(i => ScheduleSync.isCached(i.cacheKey));

  const cutTo = (next: ScheduleSlot) => {
    const step = ScheduleClock.nextStep(-1, playable(next.items), "loop");
    slotRef.current = next;
    indexRef.current = "index" in step ? step.index : -1;
    setSlot(next);
    setIndex(indexRef.current);
    setCycle(c => c + 1);
  };

  const tick = () => {
    if (pinnedRef.current) return;
    const next = ScheduleClock.resolve(ScheduleSync.manifest, Date.now(), finishedRef.current);
    if (next.key !== slotRef.current.key) cutTo(next);
    else if (next.items !== slotRef.current.items) {
      slotRef.current = next;
      setSlot(next);
    }
    if (indexRef.current === -1 || !ScheduleSync.isCached(slotRef.current.items[indexRef.current]?.cacheKey)) advance();
  };

  const advance = () => {
    const current = slotRef.current;
    const step = ScheduleClock.nextStep(indexRef.current, playable(), pinnedRef.current ? "loop" : current.behavior);
    if ("index" in step) {
      if (step.index === -1 && indexRef.current === -1) return;
      indexRef.current = step.index;
      setIndex(step.index);
      setCycle(c => c + 1);
    } else if ("finished" in step && indexRef.current >= 0) {
      finishedRef.current = current.key;
      tick();
    }
  };

  const item = index >= 0 ? slot.items[index] : null;
  const file: MessageFileInterface | null = useMemo(() => item && {
    id: item.cacheKey,
    name: item.title,
    url: "file://" + ScheduleSync.localPath(item),
    fileType: item.mediaType,
    seconds: item.seconds,
    loopVideo: item.loopVideo
  }, [item?.cacheKey, cycle]);

  useEffect(() => {
    ScheduleSync.nowPlaying = item ? { occurrenceId: slot.occurrence?.id || null, cacheKey: item.cacheKey, title: item.title } : null;
    if (slideTimer.current) clearTimeout(slideTimer.current);
    const seconds = PlayerHelper.slideSeconds(file);
    if (file && seconds > 0) slideTimer.current = setTimeout(advance, seconds * 1000);
    return () => { if (slideTimer.current) clearTimeout(slideTimer.current); };
  }, [file]);

  const hidePanel = () => {
    if (panelTimer.current) clearTimeout(panelTimer.current);
    setPanelVisible(false);
  };

  const showPanel = () => {
    if (panelTimer.current) clearTimeout(panelTimer.current);
    panelTimer.current = setTimeout(() => setPanelVisible(false), PANEL_SECONDS * 1000);
    setPanelVisible(true);
  };

  useTVEventHandler((evt: HWEvent) => {
    if (panelVisibleRef.current) showPanel();
    else if (evt.eventType === "select" || evt.eventType === "up") showPanel();
  });

  useEffect(() => {
    tick();
    const clock = setInterval(tick, 1000);
    const unsubscribe = ScheduleSync.subscribe(() => {
      if (!ScheduleSync.isScheduled()) return props.navigateTo("schedulePairing");
      refresh();
      tick();
    });
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (panelVisibleRef.current) hidePanel();
      else showPanel();
      return true;
    });
    return () => {
      clearInterval(clock);
      unsubscribe();
      backHandler.remove();
      if (panelTimer.current) clearTimeout(panelTimer.current);
    };
  }, []);

  // A select that opens the panel must not also press the button that was focused when it last closed.
  const guarded = (fn: () => void) => () => { if (panelVisibleRef.current) fn(); };

  const leave = (page: string, data?: any) => {
    hidePanel();
    props.navigateTo(page, data);
  };

  const browse = () => {
    const providerId = CachedData.connectedProviders[0];
    if (!providerId) return leave("providers");
    CachedData.activeProvider = providerId;
    leave("contentBrowser", { providerId, folderStack: [] });
  };

  const togglePin = () => {
    pinnedRef.current = !pinned;
    setPinned(!pinned);
    if (pinned) tick();
    showPanel();
  };

  const manifest = ScheduleSync.manifest;
  const allItems = ScheduleSync.allItems();
  const cachedCount = allItems.filter(i => ScheduleSync.isCached(i.cacheKey)).length;

  const title = slot.occurrence
    ? slot.occurrence.title || t("schedule.scheduled")
    : manifest?.fallbackTitle || t("schedule.defaultLoop");

  const subtitle = () => {
    const parts = [t("schedule.itemOf", { current: Math.max(index + 1, 0), total: slot.items.length })];
    const next = ScheduleClock.nextOccurrence(manifest, Date.now());
    if (next) parts.push(t("schedule.nextAt", { title: next.title || t("schedule.scheduled"), time: formatTime(next.start, manifest?.timeZone) }));
    return parts.join(" · ");
  };

  const readiness = () => {
    const through = ScheduleClock.readyThrough(manifest, k => ScheduleSync.isCached(k), Date.now());
    if (!through) return t("schedule.notReady");
    let date: string;
    try {
      date = new Date(through).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: manifest?.timeZone });
    } catch {
      date = new Date(through).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }
    return t("schedule.readyThrough", { date });
  };

  const panelButton = (key: string, label: string, onPress: () => void, solid = false) => (
    <TouchableHighlight
      key={key}
      onPress={onPress}
      onFocus={() => { setFocused(key); showPanel(); }}
      underlayColor={Colors.primary}
      hasTVPreferredFocus={key === "pin"}
      style={{
        ...Styles.smallMenuClickable,
        width: "auto",
        backgroundColor: solid ? "#C2185B" : "transparent",
        borderWidth: 2,
        borderColor: focused === key ? Colors.primary : solid ? "#C2185B" : "rgba(255, 255, 255, 0.15)",
        marginRight: DimensionHelper.wp("1%"),
        borderRadius: 5
      }}
    >
      <Text style={{ ...Styles.smallWhiteText, fontSize: Typography.bodyMedium }} numberOfLines={1}>{label}</Text>
    </TouchableHighlight>
  );

  const placeholder = () => {
    if (!manifest) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textDimmed, fontSize: Typography.bodySmall, marginTop: DimensionHelper.hp("2%") }}>{t("schedule.loading")}</Text>
        </View>
      );
    }
    const text = slot.items.length === 0 ? t("schedule.nothingScheduled") : t("schedule.waitingForFiles", { count: cachedCount, total: allItems.length });
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: Colors.textDimmed, fontSize: Typography.bodySmall }}>{text}</Text>
      </View>
    );
  };

  const minutesAgo = ScheduleSync.lastChecked ? Math.round((Date.now() - ScheduleSync.lastChecked) / 60000) : null;

  return (
    <View style={{ flex: 1, width: "100%", backgroundColor: "#000" }} testID="scheduled-player-root">
      <PlayerErrorBoundary onBack={showPanel}>
        {file ? <Message key={slot.key + "|" + cycle} file={file} downloaded={false} paused={false} onEnd={advance} /> : placeholder()}
      </PlayerErrorBoundary>

      {panelVisible && (
        <LinearGradient
          colors={["rgba(0, 0, 0, 0.92)", "rgba(0, 0, 0, 0)"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.75, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <View style={{ position: "absolute", top: DimensionHelper.hp("4%"), right: DimensionHelper.wp("3%"), alignItems: "flex-end" }}>
            <Text style={{ color: Colors.textSubtle, fontSize: Typography.labelSmall }}>{readiness()}</Text>
            <Text style={{ color: Colors.success, fontSize: Typography.labelSmall, fontWeight: "500" }}>
              {t("schedule.filesDownloaded", { count: cachedCount, total: allItems.length })}
            </Text>
            <View style={{ width: DimensionHelper.wp("15%"), height: 3, backgroundColor: Colors.progressBackground, borderRadius: 2, marginTop: DimensionHelper.hp("1%") }}>
              <View style={{ width: `${allItems.length ? (cachedCount / allItems.length) * 100 : 100}%`, height: "100%", backgroundColor: Colors.success, borderRadius: 2 }} />
            </View>
          </View>

          <View style={{ position: "absolute", left: DimensionHelper.wp("5%"), bottom: DimensionHelper.hp("10%"), maxWidth: "60%" }}>
            <Text style={Styles.H2}>{title}</Text>
            <Text style={{ ...Styles.H3, color: Colors.textLight, marginBottom: DimensionHelper.hp("2.5%") }}>{subtitle()}</Text>
            <View style={{ flexDirection: "row" }}>
              {panelButton("pin", pinned ? t("schedule.unpin") : t("schedule.pin"), guarded(togglePin), true)}
              {panelButton("browse", t("schedule.browse"), guarded(browse))}
              {panelButton("settings", t("schedule.settings"), guarded(() => leave("settings")))}
            </View>
            {manifest && minutesAgo !== null && (
              <Text style={{ color: Colors.textDimmed, fontSize: Typography.labelSmall, marginTop: DimensionHelper.hp("2%") }}>
                {t("schedule.lastChecked", { rev: manifest.rev, minutes: minutesAgo })}
              </Text>
            )}
          </View>
        </LinearGradient>
      )}
    </View>
  );
};
