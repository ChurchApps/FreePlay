import React, { useEffect } from "react";
import { View, Text, TouchableHighlight, ActivityIndicator, BackHandler, ImageBackground } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { ApiHelper, CachedData, Styles } from "../helpers";
import { Colors } from "../helpers/Styles";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { PlanInterface, FeedVenueInterface, LessonPlaylistFileInterface, PlanItemInterface } from "../interfaces";
import LinearGradient from "react-native-linear-gradient";

type Props = {
  navigateTo(page: string): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const PlanDownloadScreen = (props: Props) => {
  const [plan, setPlan] = React.useState<PlanInterface | null>(null);
  const [venue, setVenue] = React.useState<FeedVenueInterface | null>(null);
  const [planItems, setPlanItems] = React.useState<PlanItemInterface[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [cachedItems, setCachedItems] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState("");
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [offlineCheck, setOfflineCheck] = React.useState(false);

  const updateCounts = (cached: number, total: number): void => {
    setCachedItems(cached);
    setTotalItems(total);
  };

  // Build maps for both actionId -> files and sectionId -> files
  const buildFileMaps = (venueData: FeedVenueInterface): { actionMap: Map<string, LessonPlaylistFileInterface[]>, sectionMap: Map<string, LessonPlaylistFileInterface[]> } => {
    const actionMap = new Map<string, LessonPlaylistFileInterface[]>();
    const sectionMap = new Map<string, LessonPlaylistFileInterface[]>();

    venueData.sections?.forEach(section => {
      const sectionFiles: LessonPlaylistFileInterface[] = [];

      section.actions?.forEach(action => {
        const actionType = action.actionType?.toLowerCase();
        if (actionType === "play" || actionType === "add-on") {
          const files: LessonPlaylistFileInterface[] = [];
          action.files?.forEach(file => {
            const fileEntry: LessonPlaylistFileInterface = {
              id: file.id,
              name: file.name,
              url: file.url || "",
              seconds: file.seconds || 10,
              fileType: file.fileType
            };
            files.push(fileEntry);
            sectionFiles.push(fileEntry); // Also add to section files
          });
          if (action.id) {
            actionMap.set(action.id, files);
          }
        }
      });

      // Store all play files for this section
      if (section.id) {
        sectionMap.set(section.id, sectionFiles);
      }
    });

    return { actionMap, sectionMap };
  };

  // Recursively collect relatedIds from planItems in sorted order
  const collectRelatedIds = (items: PlanItemInterface[]): { id: string, itemType: string }[] => {
    const relatedIds: { id: string, itemType: string }[] = [];
    const sortedItems = [...items].sort((a, b) => (a.sort || 0) - (b.sort || 0));

    for (const item of sortedItems) {
      const t = item.itemType;
      // Sections: item, lessonSection, providerSection, section
      // Actions: lessonAction, providerPresentation, action, lessonAddOn, providerFile
      if (item.relatedId && (t === "lessonAction" || t === "item" || t === "lessonSection" || t === "lessonAddOn"
        || t === "providerPresentation" || t === "providerSection" || t === "providerFile"
        || t === "action" || t === "section")) {
        relatedIds.push({ id: item.relatedId, itemType: t });
      }
      if (item.children && item.children.length > 0) {
        relatedIds.push(...collectRelatedIds(item.children));
      }
    }

    return relatedIds;
  };

  // Fetch add-on data directly from API
  const fetchAddOn = async (addOnId: string): Promise<LessonPlaylistFileInterface[] | null> => {
    try {
      console.log("[AddOn] Fetching add-on:", addOnId);
      const data = await ApiHelper.getAnonymous(`/addOns/public/${addOnId}`, "LessonsApi");
      console.log("[AddOn] API response:", JSON.stringify(data, null, 2));
      if (!data) { console.log("[AddOn] No data returned for:", addOnId); return null; }

      const files: LessonPlaylistFileInterface[] = [];

      // Check if add-on has a video
      if (data.video) {
        const videoUrl = `https://api.lessons.church/externalVideos/download/${data.video.id}`;
        console.log("[AddOn] Video found - id:", data.video.id, "url:", videoUrl, "seconds:", data.video.seconds);
        files.push({
          id: data.video.id,
          name: data.name || "",
          url: videoUrl,
          seconds: data.video.seconds || 10,
          fileType: "video"
        });
      } else if (data.file) {
        console.log("[AddOn] File found - id:", data.file.id, "contentPath:", data.file.contentPath, "fileType:", data.file.fileType);
        // Otherwise check for a file (image)
        files.push({
          id: data.file.id,
          name: data.name || "",
          url: data.file.contentPath,
          seconds: 10,
          fileType: data.file.fileType
        });
      } else {
        console.log("[AddOn] No video or file in add-on data:", addOnId);
      }

      return files.length > 0 ? files : null;
    } catch (err) {
      console.error("[AddOn] Error fetching add-on:", addOnId, err);
      return null;
    }
  };

  const getFilesFromVenue = async (venueData: FeedVenueInterface, customPlanItems?: PlanItemInterface[]): Promise<LessonPlaylistFileInterface[]> => {
    const { actionMap, sectionMap } = buildFileMaps(venueData);

    // If we have planItems, use them to determine order and which actions/sections to include
    if (customPlanItems && customPlanItems.length > 0) {
      const relatedIds = collectRelatedIds(customPlanItems);

      // If planItems exist but have no related IDs, fall back to full venue
      if (relatedIds.length === 0) {
        // No related IDs, will use full venue
      } else {
        const result: LessonPlaylistFileInterface[] = [];

        for (const { id, itemType } of relatedIds) {
          let files: LessonPlaylistFileInterface[] | undefined | null;

          if (itemType === "item" || itemType === "lessonSection" || itemType === "providerSection" || itemType === "section") {
            // Section types - get all play files from that section
            files = sectionMap.get(id);
          } else if (itemType === "lessonAction" || itemType === "providerPresentation" || itemType === "action") {
            // Action types - get files for a specific action
            files = actionMap.get(id);
          } else if (itemType === "lessonAddOn" || itemType === "providerFile") {
            // Legacy add-on / file types - try actionMap first, then fetch from API
            files = actionMap.get(id);
            if (!files || files.length === 0) {
              files = await fetchAddOn(id);
            }
          }

          if (files) {
            result.push(...files);
          }
        }

        if (result.length > 0) {
          return result;
        }
        // No files found for planItems, falling back to full venue
      }
    }

    // No planItems or no matching items - return all files from venue in original order
    const result: LessonPlaylistFileInterface[] = [];
    venueData.sections?.forEach(section => {
      section.actions?.forEach(action => {
        const actionType = action.actionType?.toLowerCase();
        if (actionType === "play" || actionType === "add-on") {
          action.files?.forEach(file => {
            result.push({
              id: file.id,
              name: file.name,
              url: file.url || "",
              seconds: file.seconds || 10,
              fileType: file.fileType
            });
          });
        }
      });
    });

    return result;
  };

  const handleStart = () => {
    props.navigateTo("player");
  };

  const getVersion = () => {
    const pkg = require("../../package.json");
    return (
      <Text style={{ ...Styles.smallWhiteText, textAlign: "left", fontSize: 12, paddingBottom: 15, color: "#999999", paddingTop: 15 }}>
        Version: {pkg.version}
      </Text>
    );
  };

  const getContent = () => {
    if (!plan) return <ActivityIndicator size="small" color="gray" animating={true} />;
    else {
      if (ready && cachedItems === totalItems) {
        return (
          <>
            <Text style={Styles.H2}>{plan.name || "Service Plan"}</Text>
            {plan.serviceDate && (
              <Text style={Styles.H3}>
                {new Date(plan.serviceDate).toLocaleDateString()}
              </Text>
            )}
            {venue?.lessonName && (
              <Text style={{ ...Styles.smallerWhiteText, color: "#CCCCCC" }}>
                {venue.lessonName}
              </Text>
            )}
            <TouchableHighlight
              style={{
                ...Styles.smallMenuClickable,
                backgroundColor: "#C2185B",
                width: DimensionHelper.wp("18%"),
                marginTop: DimensionHelper.hp("1%"),
                borderRadius: 5
              }}
              underlayColor={"#E91E63"}
              onPress={() => handleStart()}
              hasTVPreferredFocus={true}
            >
              <Text style={{ ...Styles.smallWhiteText, width: "100%" }} numberOfLines={1}>
                Start Plan
              </Text>
            </TouchableHighlight>
            {getVersion()}
          </>
        );
      } else {
        return (
          <>
            <Text style={Styles.H2}>{plan.name || "Service Plan"}</Text>
            {plan.serviceDate && (
              <Text style={Styles.H3}>
                {new Date(plan.serviceDate).toLocaleDateString()}
              </Text>
            )}
            <TouchableHighlight
              style={{
                ...Styles.smallMenuClickable,
                backgroundColor: "#999999",
                width: DimensionHelper.wp("35%"),
                marginTop: DimensionHelper.hp("1%"),
                borderRadius: 5
              }}
              underlayColor={"#999999"}
            >
              <Text style={{ ...Styles.smallWhiteText, width: "100%" }} numberOfLines={1}>
                Downloading item {cachedItems} of {totalItems}
              </Text>
            </TouchableHighlight>
            {getVersion()}
          </>
        );
      }
    }
  };

  const loadData = async () => {
    setLoading(true);

    // Load cached data first
    const cachedPlan = await CachedData.getAsyncStorage("currentPlan");
    if (cachedPlan) setPlan(cachedPlan);

    try {
      // Load current plan by planTypeId
      const planTypeId = CachedData.planTypeId;
      if (!planTypeId) {
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      const currentPlan: PlanInterface = await ApiHelper.getAnonymous(
        `/plans/public/current/${planTypeId}`,
        "DoingApi"
      );

      if (!currentPlan) {
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      setPlan(currentPlan);
      CachedData.currentPlan = currentPlan;
      await CachedData.setAsyncStorage("currentPlan", currentPlan);

      // Fetch planItems for the plan
      if (currentPlan.id && currentPlan.churchId) {
        try {
          const items: PlanItemInterface[] = await ApiHelper.getAnonymous(
            `/planItems/presenter/${currentPlan.churchId}/${currentPlan.id}`,
            "DoingApi"
          );
          setPlanItems(items || []);
          await CachedData.setAsyncStorage("planItems", items || []);
        } catch {
          setPlanItems([]);
        }
      }

      // If plan has venue content, load it
      if (currentPlan.contentType === "venue" && currentPlan.contentId) {
        const venueData: FeedVenueInterface = await ApiHelper.getAnonymous(
          `/venues/public/feed/${currentPlan.contentId}`,
          "LessonsApi"
        );
        setVenue(venueData);
        CachedData.planVenue = venueData;
        await CachedData.setAsyncStorage("planVenue", venueData);
      }
    } catch (ex) {
      console.error("Error loading plan:", ex);
      if (ex.toString().indexOf("Network request failed") > -1) {
        props.navigateTo("offline");
      }
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async () => {
    if (venue) {
      // Pass planItems to get files in the customized order (if any)
      const files = await getFilesFromVenue(venue, planItems);
      if (files.length > 0) {
        CachedData.messageFiles = files;
        await CachedData.setAsyncStorage("messageFiles", files);
        setReady(false);
        CachedData.prefetch(files, updateCounts).then(() => {
          setReady(true);
        });
      } else {
        // No media files, still mark as ready
        CachedData.messageFiles = [];
        setReady(true);
      }
    }
  };

  const handleBack = () => {
    props.sidebarState(true);
  };

  const init = () => {
    const timer = setInterval(() => {
      setRefreshKey(new Date().getTime().toString());
    }, 60 * 60 * 1000); // Refresh hourly

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    setTimeout(() => setOfflineCheck(true), 5000);

    return () => {
      clearInterval(timer);
      backHandler.remove();
    };
  };

  useEffect(init, []);
  useEffect(() => { loadData(); }, [refreshKey]);
  // Start download when venue is loaded (planItems will already be set by then)
  useEffect(() => { if (venue) startDownload(); }, [venue, planItems]);
  useEffect(() => {
    if (offlineCheck && loading) props.navigateTo("offline");
  }, [offlineCheck]);

  if (loadFailed) {
    return (
      <View style={{ ...Styles.menuScreen, flex: 1, width: DimensionHelper.wp("100%"), justifyContent: "center", alignItems: "center" }}>
        <Icon name="error-outline" size={DimensionHelper.wp("4%")} color={Colors.error} />
        <Text style={{ ...Styles.bigWhiteText, marginTop: DimensionHelper.hp("2%") }}>
          The plan could not be loaded.
        </Text>
        <Text style={{ ...Styles.whiteText, marginTop: DimensionHelper.hp("1%") }}>
          Make sure a plan is scheduled for this plan type.
        </Text>
        <TouchableHighlight
          style={{ backgroundColor: Colors.primaryDark, paddingVertical: DimensionHelper.hp("1.5%"), paddingHorizontal: DimensionHelper.wp("3%"), marginTop: DimensionHelper.hp("3%"), borderRadius: 12 }}
          underlayColor={Colors.primary}
          onPress={() => { setLoadFailed(false); setRefreshKey(new Date().getTime().toString()); }}
          hasTVPreferredFocus={true}
        >
          <Text style={Styles.smallWhiteText}>Try Again</Text>
        </TouchableHighlight>
      </View>
    );
  }

  const backgroundImage = venue?.lessonImage;

  const contentOverlay = (
    <LinearGradient
      colors={["rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 0)"]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 9, justifyContent: "flex-end", flexDirection: "column" }}>
        <View
          style={{
            justifyContent: "flex-start",
            flexDirection: "row",
            paddingLeft: DimensionHelper.wp("5%")
          }}
        >
          <View style={{ maxWidth: "60%" }}>{getContent()}</View>
        </View>
      </View>
      <View style={{ flex: 1 }}></View>
    </LinearGradient>
  );

  // If we have a background image, show it with overlay gradient
  if (backgroundImage) {
    return (
      <View style={{ ...Styles.menuScreen, flex: 1, flexDirection: "row" }}>
        <ImageBackground
          source={{ uri: backgroundImage }}
          resizeMode="cover"
          style={{ flex: 1, width: "100%" }}
        >
          {contentOverlay}
        </ImageBackground>
      </View>
    );
  }

  // Otherwise show a nice gradient background
  return (
    <View style={{ ...Styles.menuScreen, flex: 1, flexDirection: "row" }}>
      <LinearGradient
        colors={["#1a0f17", "#3d1a36", "#0f0a16"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, width: "100%" }}
      >
        <View style={{ flex: 9, justifyContent: "flex-end", flexDirection: "column" }}>
          <View
            style={{
              justifyContent: "flex-start",
              flexDirection: "row",
              paddingLeft: DimensionHelper.wp("5%")
            }}
          >
            <View style={{ maxWidth: "60%" }}>{getContent()}</View>
          </View>
        </View>
        <View style={{ flex: 1 }}></View>
      </LinearGradient>
    </View>
  );
};
