import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { View, Text, TouchableHighlight, BackHandler, ActivityIndicator, HWEvent, useTVEventHandler } from "react-native";
import { useTranslation } from "react-i18next";
import { useKeepAwake } from "expo-keep-awake";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialIcons";
import { CachedData, Colors, ScheduleClock, ScheduleSync, Styles, Typography } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { PlayerHelper } from "../helpers/PlayerHelper";
import { SoundHelper } from "../helpers/SoundHelper";
import { MessageFileInterface } from "../interfaces";
import { Message, PlayerErrorBoundary, SelectMessage } from "../components";
import type { MessageHandle } from "../components/Message";
import type { ScheduleSlot } from "../helpers/ScheduleClock";

type Props = { navigateTo(page: string, data?: any): void; };

const PANEL_SECONDS = 8;
const SEEK_SECONDS = 10;

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
  const [paused, setPaused] = useState(false);
  const [overviewVisible, setOverviewVisible] = useState(false);

  const slotRef = useRef(slot);
  const indexRef = useRef(index);
  const pinnedRef = useRef(pinned);
  const finishedRef = useRef<string | null>(null);
  const videoEndedRef = useRef(false);
  const panelVisibleRef = useRef(false);
  const overviewVisibleRef = useRef(false);
  const panelTimer = useRef<NodeJS.Timeout | null>(null);
  const slideTimer = useRef<NodeJS.Timeout | null>(null);
  const messageRef = useRef<MessageHandle>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const fileRef = useRef<MessageFileInterface | null>(null);
  slotRef.current = slot;
  indexRef.current = index;
  pinnedRef.current = pinned;
  panelVisibleRef.current = panelVisible;
  overviewVisibleRef.current = overviewVisible;

  const playable = (items = slotRef.current.items) => items.map(i => ScheduleSync.isCached(i.cacheKey));

  const goTo = (i: number) => {
    indexRef.current = i;
    videoEndedRef.current = false;
    positionRef.current = 0;
    durationRef.current = 0;
    setIndex(i);
    setCycle(c => c + 1);
    setPaused(false);
  };

  const cutTo = (next: ScheduleSlot) => {
    const step = ScheduleClock.nextStep(-1, playable(next.items), "loop");
    slotRef.current = next;
    setSlot(next);
    goTo("index" in step ? step.index : -1);
  };

  // A teacher paced slot stays up past its end time until the teacher is through its last item.
  const stayOn = () => {
    const current = slotRef.current;
    const lastDone = current.items[indexRef.current]?.mediaType === "image" || videoEndedRef.current;
    const kept = ScheduleClock.keepsSlot(current, indexRef.current, playable(), lastDone) ? current : null;
    ScheduleSync.holding = kept ? kept.items : [];
    return kept;
  };

  const tick = () => {
    if (pinnedRef.current) return;
    const next = ScheduleClock.resolve(ScheduleSync.manifest, Date.now(), finishedRef.current, stayOn());
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
      goTo(step.index);
    } else if ("hold" in step) {
      videoEndedRef.current = true;
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
  fileRef.current = file;

  useEffect(() => {
    ScheduleSync.nowPlaying = item ? { occurrenceId: slot.occurrence?.id || null, cacheKey: item.cacheKey, title: item.title } : null;
    if (slideTimer.current) clearTimeout(slideTimer.current);
    const seconds = PlayerHelper.slideSeconds(file);
    if (file && ScheduleClock.autoAdvance(overviewVisible, paused, slot.behavior, seconds > 0)) slideTimer.current = setTimeout(advance, seconds * 1000);
    return () => { if (slideTimer.current) clearTimeout(slideTimer.current); };
  }, [file, paused, slot.behavior, overviewVisible]);

  const hidePanel = () => {
    if (panelTimer.current) clearTimeout(panelTimer.current);
    setPanelVisible(false);
  };

  const showPanel = () => {
    if (panelTimer.current) clearTimeout(panelTimer.current);
    panelTimer.current = setTimeout(() => setPanelVisible(false), PANEL_SECONDS * 1000);
    setPanelVisible(true);
  };

  const togglePause = () => {
    if (indexRef.current < 0) return;
    SoundHelper.playClick();
    setPaused(p => !p);
  };

  const skip = (direction: 1 | -1) => {
    if (indexRef.current < 0) return;
    const behavior = pinnedRef.current ? "loop" : slotRef.current.behavior;
    const i = ScheduleClock.skip(indexRef.current, playable(), direction, behavior);
    if (i !== indexRef.current) goTo(i);
  };

  const showOverview = () => {
    hidePanel();
    if (slideTimer.current) clearTimeout(slideTimer.current);
    overviewVisibleRef.current = true;
    setOverviewVisible(true);
  };

  // The ref clears on the next render, so the select that picked a slide does not also open the panel.
  const hideOverview = () => setOverviewVisible(false);

  const jumpTo = (i: number) => {
    hideOverview();
    const target = ScheduleClock.jumpTo(slotRef.current, i);
    if (target >= 0) goTo(target);
  };

  // Seeks within a video only; on a slide fast forward and rewind do nothing.
  const seek = (delta: number) => {
    if (!PlayerHelper.isVideoFile(fileRef.current)) return;
    messageRef.current?.seek(PlayerHelper.seekTarget(positionRef.current, delta, durationRef.current));
  };

  const handleProgress = (data: { currentTime: number; playableDuration: number }) => {
    positionRef.current = data.currentTime;
    durationRef.current = data.playableDuration;
  };

  useTVEventHandler((evt: HWEvent) => {
    switch (ScheduleClock.remoteAction(evt.eventType, panelVisibleRef.current, overviewVisibleRef.current)) {
      case "panel": showPanel(); break;
      case "overview": showOverview(); break;
      case "playPause": togglePause(); break;
      case "next": skip(1); break;
      case "previous": skip(-1); break;
      case "seekForward": seek(SEEK_SECONDS); break;
      case "seekBack": seek(-SEEK_SECONDS); break;
    }
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
      if (overviewVisibleRef.current) hideOverview();
      else if (panelVisibleRef.current) hidePanel();
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

  const overviewFiles: MessageFileInterface[] = useMemo(() => slot.items.map(i => ({
    id: i.cacheKey,
    name: i.title,
    url: ScheduleSync.isCached(i.cacheKey) ? "file://" + ScheduleSync.localPath(i) : undefined,
    fileType: i.mediaType
  })), [slot.items, overviewVisible]);

  const minutesAgo = ScheduleSync.lastChecked ? Math.round((Date.now() - ScheduleSync.lastChecked) / 60000) : null;

  return (
    <View style={{ flex: 1, width: "100%", backgroundColor: "#000" }} testID="scheduled-player-root">
      <PlayerErrorBoundary onBack={showPanel}>
        {ScheduleClock.showPlayer(!!file, overviewVisible) ? <Message ref={messageRef} key={slot.key + "|" + cycle} file={file!} downloaded={false} paused={paused} onProgress={handleProgress} onEnd={advance} /> : !file && placeholder()}
      </PlayerErrorBoundary>

      {paused && file && (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" }} testID="scheduled-player-paused">
          <Icon name="play-circle-outline" size={DimensionHelper.hp("11%")} color="#fff" />
        </View>
      )}

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

      {overviewVisible && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} testID="scheduled-player-overview">
          <SelectMessage files={overviewFiles} currentIndex={index} onSelect={jumpTo} />
        </View>
      )}
    </View>
  );
};
