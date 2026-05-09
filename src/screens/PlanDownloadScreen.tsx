import React, { useEffect } from "react";
import { View, Text, TouchableHighlight, ActivityIndicator, BackHandler, ImageBackground } from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialIcons";
import { ApiHelper, CachedData, Styles, DownloadIndex, ProviderAuthHelper } from "../helpers";
import { Colors } from "../helpers/Styles";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { PlanInterface, MessageFileInterface, PlanItemInterface } from "../interfaces";
import { getProvider, type Instructions, type InstructionItem } from "../providers";
import LinearGradient from "react-native-linear-gradient";

type Props = {
  navigateTo(page: string): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

// Walk an InstructionItem subtree and collect every node that has a downloadUrl.
function collectFilesFromNode(node: InstructionItem): MessageFileInterface[] {
  const files: MessageFileInterface[] = [];
  if (node.downloadUrl) {
    files.push({
      id: node.id,
      name: node.label || "",
      url: node.downloadUrl,
      seconds: node.seconds || 10
    });
  }
  if (node.children) {
    for (const child of node.children) files.push(...collectFilesFromNode(child));
  }
  return files;
}

// Build maps from instruction tree: section id → all descendant files; item id → that item's files.
function buildFileMaps(items: InstructionItem[]): { sectionMap: Map<string, MessageFileInterface[]>, itemMap: Map<string, MessageFileInterface[]> } {
  const sectionMap = new Map<string, MessageFileInterface[]>();
  const itemMap = new Map<string, MessageFileInterface[]>();

  const walk = (nodes: InstructionItem[]) => {
    for (const node of nodes) {
      const key = node.relatedId || node.id;
      if (key) {
        const files = collectFilesFromNode(node);
        if (node.itemType === "section") sectionMap.set(key, files);
        else if (files.length > 0) itemMap.set(key, files);
      }
      if (node.children) walk(node.children);
    }
  };
  walk(items);
  return { sectionMap, itemMap };
}

const SECTION_TYPES = new Set(["item", "section", "lessonSection", "providerSection"]);
const ACTION_TYPES = new Set(["action", "lessonAction", "providerPresentation", "lessonAddOn", "addon", "providerFile", "file"]);

// Walk customized planItems and produce an ordered list of {id, itemType} to look up.
function collectRelatedIds(items: PlanItemInterface[]): { id: string, itemType: string }[] {
  const out: { id: string, itemType: string }[] = [];
  const sorted = [...items].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  for (const item of sorted) {
    const t = item.itemType || "";
    if (item.relatedId && (SECTION_TYPES.has(t) || ACTION_TYPES.has(t))) {
      out.push({ id: item.relatedId, itemType: t });
    }
    if (item.children?.length) out.push(...collectRelatedIds(item.children));
  }
  return out;
}

function getOrderedFiles(instructions: Instructions, customPlanItems?: PlanItemInterface[]): MessageFileInterface[] {
  const { sectionMap, itemMap } = buildFileMaps(instructions.items || []);

  if (customPlanItems && customPlanItems.length > 0) {
    const relatedIds = collectRelatedIds(customPlanItems);
    if (relatedIds.length > 0) {
      const result: MessageFileInterface[] = [];
      for (const { id, itemType } of relatedIds) {
        const files = SECTION_TYPES.has(itemType) ? sectionMap.get(id) : itemMap.get(id);
        if (files) result.push(...files);
      }
      if (result.length > 0) return result;
    }
  }

  // No customization (or no matches) - return every playable file in tree order.
  const all: MessageFileInterface[] = [];
  for (const item of instructions.items || []) all.push(...collectFilesFromNode(item));
  return all;
}

export const PlanDownloadScreen = (props: Props) => {
  const { t } = useTranslation();
  const [plan, setPlan] = React.useState<PlanInterface | null>(null);
  const [instructions, setInstructions] = React.useState<Instructions | null>(null);
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

  const handleStart = () => {
    props.navigateTo("player");
  };

  const getVersion = () => {
    const pkg = require("../../package.json");
    return (
      <Text style={{ ...Styles.smallWhiteText, textAlign: "left", fontSize: 12, paddingBottom: 15, color: "#999999", paddingTop: 15 }}>
        {t("common.version", { version: pkg.version })}
      </Text>
    );
  };

  const getContent = () => {
    if (!plan) return <ActivityIndicator size="small" color="gray" animating={true} />;
    if (ready && cachedItems === totalItems) {
      return (
        <>
          <Text style={Styles.H2}>{plan.name || t("planDownload.fallbackName")}</Text>
          {plan.serviceDate && (
            <Text style={Styles.H3}>{new Date(plan.serviceDate).toLocaleDateString()}</Text>
          )}
          {instructions?.name && (
            <Text style={{ ...Styles.smallerWhiteText, color: "#CCCCCC" }}>{instructions.name}</Text>
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
              {t("planDownload.startPlan")}
            </Text>
          </TouchableHighlight>
          {getVersion()}
        </>
      );
    }
    return (
      <>
        <Text style={Styles.H2}>{plan.name || t("planDownload.fallbackName")}</Text>
        {plan.serviceDate && (
          <Text style={Styles.H3}>{new Date(plan.serviceDate).toLocaleDateString()}</Text>
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
            {t("planDownload.downloadingItem", { current: cachedItems, total: totalItems })}
          </Text>
        </TouchableHighlight>
        {getVersion()}
      </>
    );
  };

  const loadData = async () => {
    setLoading(true);

    const cachedPlan = await CachedData.getAsyncStorage("currentPlan");
    if (cachedPlan) setPlan(cachedPlan);

    try {
      const planTypeId = CachedData.planTypeId;
      if (!planTypeId) { setLoadFailed(true); setLoading(false); return; }

      const currentPlan: PlanInterface = await ApiHelper.getAnonymous(
        `/plans/public/current/${planTypeId}`,
        "DoingApi"
      );
      if (!currentPlan) { setLoadFailed(true); setLoading(false); return; }

      setPlan(currentPlan);
      CachedData.currentPlan = currentPlan;
      await CachedData.setAsyncStorage("currentPlan", currentPlan);

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

      // Resolve provider + content path from the plan and ask the provider for its instruction tree.
      // Plans paired before content was tracked via providerId/providerPlanId can't load here — they
      // need to be re-paired by a staff member.
      if (currentPlan.providerId && currentPlan.providerPlanId) {
        const provider = getProvider(currentPlan.providerId);
        if (!provider?.getInstructions) {
          setLoadFailed(true);
          return;
        }
        const auth = await ProviderAuthHelper.refreshIfNeeded(currentPlan.providerId);
        const result = await provider.getInstructions(currentPlan.providerPlanId, auth);
        setInstructions(result);
        CachedData.planInstructions = result;
        await CachedData.setAsyncStorage("planInstructions", result);
      } else {
        setInstructions(null);
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
    if (!instructions) return;
    const files = getOrderedFiles(instructions, planItems);
    if (files.length === 0) {
      CachedData.messageFiles = [];
      setReady(true);
      return;
    }
    CachedData.messageFiles = files;
    await CachedData.setAsyncStorage("messageFiles", files);
    setReady(false);
    CachedData.prefetch(files, updateCounts).then(() => {
      setReady(true);
      DownloadIndex.addEntry({
        downloadKey: DownloadIndex.generateKey("plan", { planId: plan?.id || "", contentPath: plan?.providerPlanId || "" }),
        source: "plan",
        title: plan?.name || t("planDownload.fallbackName"),
        description: instructions.name,
        messageFiles: files,
        downloadedAt: Date.now()
      });
    });
  };

  const handleBack = () => {
    props.sidebarState(true);
  };

  const init = () => {
    const timer = setInterval(() => {
      setRefreshKey(new Date().getTime().toString());
    }, 60 * 60 * 1000);

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
  useEffect(() => { if (instructions) startDownload(); }, [instructions, planItems]);
  useEffect(() => {
    if (offlineCheck && loading) props.navigateTo("offline");
  }, [offlineCheck]);

  if (loadFailed) {
    return (
      <View style={{ ...Styles.menuScreen, flex: 1, width: DimensionHelper.wp("100%"), justifyContent: "center", alignItems: "center" }}>
        <Icon name="error-outline" size={DimensionHelper.wp("4%")} color={Colors.error} />
        <Text style={{ ...Styles.bigWhiteText, marginTop: DimensionHelper.hp("2%") }}>
          {t("planDownload.loadFailed")}
        </Text>
        <Text style={{ ...Styles.whiteText, marginTop: DimensionHelper.hp("1%") }}>
          {t("planDownload.loadFailedSub")}
        </Text>
        <TouchableHighlight
          style={{ backgroundColor: Colors.primaryDark, paddingVertical: DimensionHelper.hp("1.5%"), paddingHorizontal: DimensionHelper.wp("3%"), marginTop: DimensionHelper.hp("3%"), borderRadius: 12 }}
          underlayColor={Colors.primary}
          onPress={() => { setLoadFailed(false); setRefreshKey(new Date().getTime().toString()); }}
          hasTVPreferredFocus={true}
        >
          <Text style={Styles.smallWhiteText}>{t("planDownload.tryAgain")}</Text>
        </TouchableHighlight>
      </View>
    );
  }

  const contentOverlay = (
    <LinearGradient
      colors={["rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 0)"]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 9, justifyContent: "flex-end", flexDirection: "column" }}>
        <View style={{ justifyContent: "flex-start", flexDirection: "row", paddingLeft: DimensionHelper.wp("5%") }}>
          <View style={{ maxWidth: "60%" }}>{getContent()}</View>
        </View>
      </View>
      <View style={{ flex: 1 }}></View>
    </LinearGradient>
  );

  return (
    <View style={{ ...Styles.menuScreen, flex: 1, flexDirection: "row" }}>
      <LinearGradient
        colors={["#1a0f17", "#3d1a36", "#0f0a16"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, width: "100%" }}
      >
        {contentOverlay}
      </LinearGradient>
    </View>
  );
};
