import React from "react";
import { CachedData } from "../helpers";
import { LessonPlaylistFileInterface } from "../interfaces";
import { Image, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { DimensionHelper } from "../helpers/DimensionHelper";
import Video from "react-native-video";

type Props = {
  file: LessonPlaylistFileInterface,
  downloaded: boolean,
  paused: boolean,
  onProgress?: (data: { currentTime: number; playableDuration: number }) => void,
  onEnd?: () => void
};

export type MessageHandle = {
  seek: (time: number) => void;
};

export const Message = React.forwardRef<MessageHandle, Props>((props, ref) => {

  const videoRef = React.useRef<any>(null);
  const [internalPaused, setInternalPaused] = React.useState(props.paused);
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    seek: (time: number) => { videoRef.current?.seek(time); }
  }));

  React.useEffect(() => {
    setInternalPaused(props.paused);
  }, [props.paused]);

  React.useEffect(() => {
    setInternalPaused(props.paused);
    setHasError(false); // Reset error state when file changes
    setIsLoading(true); // Reset loading state when file changes
    setShowLoadingOverlay(false); // Reset overlay immediately on file change
  }, [props.file]);

  // Delay showing loading overlay by 1 second to avoid flashing on quick transitions
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLoading) {
      timer = setTimeout(() => setShowLoadingOverlay(true), 1000);
    } else {
      setShowLoadingOverlay(false);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [isLoading]);

  const handleVideoError = (error: any) => {
    console.log("Video load error, advancing to next:", props.file?.url, error);
    setIsLoading(false);
    if (props.onEnd) props.onEnd();
  };

  // Safety timeout: if video hasn't loaded within 15 seconds, auto-advance
  React.useEffect(() => {
    if (!isLoading) return;
    const isVideo = props.file.fileType === "video"
      || /\.(mp4|webm)$/i.test((props.file.url || "").split("?")[0])
      || (props.file.url || "").includes("externalVideos");
    if (!isVideo) return;

    const safetyTimer = setTimeout(() => {
      console.log("Video load timeout, advancing to next:", props.file?.url);
      setIsLoading(false);
      if (props.onEnd) props.onEnd();
    }, 15000);

    return () => clearTimeout(safetyTimer);
  }, [isLoading, props.file]);

  // const getMessageType = () => {
  //   const parts = props.file.url.split("?")[0].split(".");
  //   const ext = parts[parts.length - 1];
  //   let result = "image"
  //   switch (ext.toLocaleLowerCase()) {
  //     case "webm":
  //     case "mp4":
  //       result = "video"
  //       break;
  //   }

  //   if (props.file.url.indexOf("externalVideos") > -1) result = "video";

  //   //console.log("Message Type:", result, props.file.url.split("?")[0])
  //   return result;
  // }

  const getMessageType = (): "image" | "video" => {
    // Check explicit fileType first
    if (props.file.fileType === "video") return "video";

    const parts = props.file.url.split("?")[0].split(".");
    const ext = parts[parts.length - 1].toLowerCase();
    // Detect video by: extension, externalVideos download URL, or /externalVideos/download/ pattern
    if (ext === "webm" || ext === "mp4" || props.file.url.includes("externalVideos")) {
      return "video";
    }
    return "image";
  };

  // const getContent = () => {
  //   let result = <></>
  //   switch (getMessageType()) {
  //     case "image":
  //       result = getImage();
  //       break;
  //     case "video":
  //       result = getVideo();
  //       break;
  //   }
  //   return result
  // }

  const getVideo = () => {
    const localPath = decodeURIComponent(CachedData.getFilePath(props.file.url));
    const filePath = props.downloaded ? "file://" + localPath : props.file.url;
    return (<Video
      ref={videoRef}
      source={{ uri: filePath }}
      repeat={props.file.loopVideo}
      resizeMode="cover"
      style={{ width: DimensionHelper.wp("100%"), height: DimensionHelper.hp("100%") }}
      paused={internalPaused}
      playInBackground={false}
      playWhenInactive={false}
      onProgress={props.onProgress}
      onLoad={() => setIsLoading(false)}
      onBuffer={({ isBuffering }) => setIsLoading(isBuffering)}
      onEnd={props.file.loopVideo ? undefined : props.onEnd}
      onError={handleVideoError}
      controls={false}
      disableFocus={true}
    />);
  };

  const getImage = () => {
    const localPath = decodeURIComponent(CachedData.getFilePath(props.file.url));
    const filePath = props.downloaded ? "file://" + localPath : props.file.url;
    return (<Image source={{ uri: filePath }} style={{ width: DimensionHelper.wp("100%"), height: DimensionHelper.hp("100%") }} />);
  };

  const content = React.useMemo(() => {
    return getMessageType() === "video" ? getVideo() : getImage();
  }, [props.file, internalPaused, props.downloaded]);

  const loadingOverlay = (
    <View style={styles.loadingOverlay}>
      <Text style={styles.loadingTitle}>Loading</Text>
      <Text style={styles.loadingSubtitle}>Preparing video content...</Text>
      <View style={styles.loadingSpinnerRow}>
        <ActivityIndicator size="large" color="#C2185B" />
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: "30%" }]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {content}
      {showLoadingOverlay && getMessageType() === "video" && loadingOverlay}
    </View>
  );

});

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center"
  },
  loadingTitle: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10
  },
  loadingSubtitle: {
    fontSize: 24,
    color: "#CCCCCC",
    marginBottom: 40
  },
  loadingSpinnerRow: { marginBottom: 30 },
  progressBarContainer: { width: "40%" },
  progressBarTrack: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#C2185B",
    borderRadius: 4
  }
});




