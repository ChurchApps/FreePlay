import React, { useRef } from "react";
import { HWEvent, BackHandler, useTVEventHandler, Pressable, TextInput, View, StyleSheet, Animated, Dimensions } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LessonInterface, ProgramInterface, StudyInterface } from "../interfaces";
import { CachedData } from "../helpers";
import { PlayerHelper } from "../helpers/PlayerHelper";
import GestureRecognizer from "react-native-swipe-gestures";
import { useKeepAwake } from "expo-keep-awake";
import { Message, SelectMessage, MessageHandle } from "../components";

type Props = {
  navigateTo(page: string, data?: any): void;
  program?: ProgramInterface;
  study?: StudyInterface;
  lesson?: LessonInterface;
  providerId?: string;
  providerStartIndex?: number;
  streaming?: boolean;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const scaleWidth = (value: number) => (value / 1920) * screenWidth;
const scaleHeight = (value: number) => (value / 1080) * screenHeight;

export const PlayerScreen = (props: Props) => {
  useKeepAwake();

  const [showSelectMessage, setShowSelectMessage] = React.useState(false);
  const [messageIndex, setMessageIndex] = React.useState(props.providerStartIndex ?? 0);
  const [paused, setPaused] = React.useState(false);
  const [triggerPauseCheck, setTriggerPauseCheck] = React.useState(0);
  const [progress, setProgress] = React.useState(0);

  // Check if we're playing provider media (from content browser)
  const isProviderMedia = !!props.providerId && !props.lesson;

  const messageRef = useRef<MessageHandle>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  const isVideoFile = (file: any) => {
    if (!file || !file.url) return false;
    if (file.fileType === "video") return true;
    const parts = file.url.split("?")[0].split(".");
    const ext = parts[parts.length - 1].toLowerCase();
    return ext === "webm" || ext === "mp4" || file.url.includes("externalVideos") || file.url.includes("stream.mux.com");
  };

  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const showFeedback = () => {

    if (!paused) {
      feedbackAnim.setValue(1);
      return;
    }

    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();
  };

  const init = () => {
    // Utilities.trackEvent("Player Screen");
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { handleBack(); return true; });
    return () => {
      backHandler.remove();
    };
  };

  const handlePlayPause = () => {
    const newPausedState = !paused;
    setPaused(newPausedState);
    PlayerHelper.pendingPause = newPausedState;
    showFeedback();

    if (newPausedState) stopTimer();
    else startTimer();
  };

  const handleRemotePress = async (pendingKey: string) => {
    if (showSelectMessage) return;
    switch (pendingKey) {
      case "right":
      case "fastForward": handleRight(); break;
      case "left":
      case "rewind": handleLeft(); break;
      case "up": handleUp(); break;
      case "previous":
      case "info":
      case "down": handleBack(); break;
      case "select":
      case "playPause": handlePlayPause(); break;
    }
  };

  useTVEventHandler((evt: HWEvent) => { handleRemotePress(evt.eventType); });

  const handleLeft = () => {
    const currentFile = CachedData.messageFiles?.[messageIndex];
    if (isVideoFile(currentFile)) {
      const newTime = Math.max(0, currentTimeRef.current - 10);
      messageRef.current?.seek(newTime);
    } else {
      stopTimer(); goBack(); startTimer();
    }
  };
  const handleRight = () => {
    const currentFile = CachedData.messageFiles?.[messageIndex];
    if (isVideoFile(currentFile)) {
      const newTime = Math.min(durationRef.current, currentTimeRef.current + 10);
      messageRef.current?.seek(newTime);
    } else {
      stopTimer(); goForward(); startTimer();
    }
  };
  const handleUp = () => { if (!showSelectMessage) { stopTimer(); setShowSelectMessage(true); } };

  const handleBack = () => {
    if (!showSelectMessage) {
      stopTimer();
      // Handle provider media - navigate back to content browser root
      if (isProviderMedia && props.providerId) {
        props.navigateTo("contentBrowser", { providerId: props.providerId, folderStack: [] });
      } else if (props.lesson) {
        props.navigateTo("lessonDetails", { program: props.program, study: props.study, lesson: props.lesson });
      } else if (CachedData.planTypeId) {
        props.navigateTo("planDownload");
      } else {
        props.navigateTo("download");
      }
    }
  };

  const goForward = () => {
    if (paused) setPaused(false);
    feedbackAnim.setValue(0);
    // Guard against null/undefined messageFiles
    if (!CachedData.messageFiles || CachedData.messageFiles.length === 0) {
      handleBack();
      return;
    }
    const idx = messageIndex + 1;
    if (idx < CachedData.messageFiles.length) setMessageIndex(idx);
    else handleBack();
  };

  const goBack = () => {
    if (paused) setPaused(false);
    feedbackAnim.setValue(0);
    // Guard against null/undefined messageFiles
    if (!CachedData.messageFiles || CachedData.messageFiles.length === 0) {
      handleBack();
      return;
    }
    const idx = messageIndex - 1;
    if (idx >= 0) setMessageIndex(idx);
    else handleBack();
  };

  const stopTimer = () => {
    if (PlayerHelper.timer) {
      clearTimeout(PlayerHelper.timer);
      PlayerHelper.timer = null;
    }
  };

  const startTimer = () => {
    if (PlayerHelper.timer) clearTimeout(PlayerHelper.timer);
    // No timer needed - videos advance on completion, images don't auto-advance
  };

  const handleVideoEnd = () => {
    if (!paused) {
      goForward();
    }
  };

  const handleMessageSelect = (index: number) => {
    if (paused) setPaused(false);
    feedbackAnim.setValue(0);
    setShowSelectMessage(false);
    setMessageIndex(index);
    startTimer();
  };

  const handlePressablePress = () => {
    setTriggerPauseCheck(Math.random());
  };

  React.useEffect(init, []);
  React.useEffect(startTimer, [messageIndex]);
  React.useEffect(() => { if (PlayerHelper.pendingPause !== paused) handlePlayPause(); }, [triggerPauseCheck]);

  const handleProgress = (data: { currentTime: number, playableDuration: number }) => {
    const { currentTime, playableDuration } = data;
    currentTimeRef.current = currentTime;
    durationRef.current = playableDuration;
    if (playableDuration > 0) setProgress(currentTime / playableDuration);
  };

  // Check if we have valid files to play
  const hasValidFiles = CachedData.messageFiles && CachedData.messageFiles.length > 0 && CachedData.messageFiles[messageIndex];

  // Navigate back if no valid files
  React.useEffect(() => {
    if (!hasValidFiles && !showSelectMessage) {
      handleBack();
    }
  }, [hasValidFiles, showSelectMessage]);

  // Show select message overlay
  if (showSelectMessage) return <SelectMessage onSelect={handleMessageSelect} />;

  // Guard against missing files - show nothing while navigating back
  if (!hasValidFiles) {
    return null;
  }

  // Get the current file to play
  const currentFile = CachedData.messageFiles[messageIndex];

  const config = { velocityThreshold: 0.3, directionalOffsetThreshold: 80 };

  const currentFileType = (() => {
    if (!currentFile || !currentFile.url) return "image"; // Default to image if file is invalid
    // Check explicit fileType first
    if (currentFile.fileType === "video") return "video";

    const parts = currentFile.url.split("?")[0].split(".");
    const ext = parts[parts.length - 1].toLowerCase();
    // Detect video by: extension, externalVideos download URL, or Mux stream URL
    if (ext === "webm" || ext === "mp4" || currentFile.url.includes("externalVideos") || currentFile.url.includes("stream.mux.com")) {
      return "video";
    }
    return "image";
  })();

  return (
    <GestureRecognizer onSwipeLeft={handleRight} onSwipeRight={handleLeft} onSwipeDown={handleUp} onSwipeUp={handleBack} config={config} style={{ flex: 1 }}>
      <Pressable onPress={handlePressablePress} style={{ flex: 1 }}>
        <Message
          ref={messageRef}
          file={currentFile}
          downloaded={!props.lesson && !props.streaming}
          paused={paused}
          onProgress={handleProgress}
          onEnd={handleVideoEnd}
        />
        <TextInput autoFocus style={{ display: "none" }} showSoftInputOnFocus={false} returnKeyType="none" />

        {currentFileType === "video" && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.overlayWrapper,
              { backgroundColor: "rgba(0,0,0,0.5)", opacity: feedbackAnim }
            ]}
          >
            <Pressable style={styles.playPauseButton} onPress={handlePlayPause}>
              <Icon name={paused ? "play-circle-outline" : "pause-circle-outline"} size={scaleHeight(120)} color="#fff" />
            </Pressable>

            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>
          </Animated.View>
        )}
      </Pressable>
    </GestureRecognizer>
  );
};

const styles = StyleSheet.create({
  overlayWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  playPauseButton: {
    justifyContent: "center",
    alignItems: "center"
  },
  progressContainer: {
    position: "absolute",
    bottom: scaleHeight(50),
    left: scaleWidth(40),
    right: scaleWidth(40),
    height: scaleHeight(10),
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: scaleHeight(5)
  },
  progressBar: {
    height: scaleHeight(10),
    backgroundColor: "#fff",
    borderRadius: scaleHeight(5)
  }
});
