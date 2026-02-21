import React from "react";
import { CachedData } from "../helpers";
import { Colors } from "../helpers/Styles";
import { LessonPlaylistFileInterface } from "../interfaces";
import { Image, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { DimensionHelper } from "../helpers/DimensionHelper";
import Video from "react-native-video";
import Icon from "react-native-vector-icons/MaterialIcons";

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
  const [showError, setShowError] = React.useState(false);
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
    setHasError(false);
    setShowError(false);
    setIsLoading(true);
    setShowLoadingOverlay(false);
  }, [props.file]);

  // Delay showing loading overlay by 1 second to avoid flashing on quick transitions
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLoading && !hasError) {
      timer = setTimeout(() => setShowLoadingOverlay(true), 1000);
    } else {
      setShowLoadingOverlay(false);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [isLoading, hasError]);

  const handleVideoError = (error: any) => {
    console.log("Video load error, advancing to next:", props.file?.url, error);
    setIsLoading(false);
    setHasError(true);
    setShowError(true);
    // Show error briefly, then auto-advance
    setTimeout(() => {
      setShowError(false);
      if (props.onEnd) props.onEnd();
    }, 3000);
  };

  // Safety timeout: if video hasn't loaded within 15 seconds, auto-advance
  React.useEffect(() => {
    if (!isLoading || hasError) return;
    const isVideo = props.file.fileType === "video"
      || /\.(mp4|webm)$/i.test((props.file.url || "").split("?")[0])
      || (props.file.url || "").includes("externalVideos");
    if (!isVideo) return;

    const safetyTimer = setTimeout(() => {
      console.log("Video load timeout, advancing to next:", props.file?.url);
      handleVideoError({ error: "timeout" });
    }, 15000);

    return () => clearTimeout(safetyTimer);
  }, [isLoading, hasError, props.file]);

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

    const url = props.file.url || "";
    const parts = url.split("?")[0].split(".");
    const ext = parts[parts.length - 1].toLowerCase();
    // Detect video by: extension, externalVideos download URL, or /externalVideos/download/ pattern
    if (ext === "webm" || ext === "mp4" || url.includes("externalVideos")) {
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
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingSubtitle}>Loading video...</Text>
    </View>
  );

  const errorOverlay = (
    <View style={styles.errorOverlay}>
      <Icon name="error-outline" size={48} color={Colors.error} />
      <Text style={styles.errorTitle}>Video failed to load</Text>
      <Text style={styles.errorSubtitle}>Skipping to next item...</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {content}
      {showLoadingOverlay && getMessageType() === "video" && loadingOverlay}
      {showError && errorOverlay}
    </View>
  );

});

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center"
  },
  loadingSubtitle: {
    fontSize: 20,
    color: Colors.textLight,
    marginTop: 16
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center"
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.error,
    marginTop: 12
  },
  errorSubtitle: {
    fontSize: 18,
    color: Colors.textLight,
    marginTop: 8
  }
});




