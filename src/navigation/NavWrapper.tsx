import { DimensionHelper } from "../helpers/DimensionHelper";
import {
  Animated,
  Easing,
  Text,
  View,
  findNodeHandle,
  useTVEventHandler
} from "react-native";

import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CachedData, Styles, Colors, ProviderSettingsHelper } from "../helpers";
import { SoundHelper } from "../helpers/SoundHelper";
import { NavItem } from "./NavItem";
import { getProvider } from "../providers";
import { FreePlayLogo } from "../components";

type Props = {
  screen: React.JSX.Element;
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const NavWrapper = (props: Props) => {
  const { t } = useTranslation();
  const _browseRef = useRef(null);
  const planRef = useRef(null);
  const announcementsRef = useRef(null);
  const settingsRef = useRef(null);
  const providerRefs = useRef<{[key: string]: any}>({});
  const recentlyCollapsed = useRef(false);
  const sidebarMounted = useRef(false);

  const fullScreenModeScreens = ["planDownload"];
  const isFullScreenMode = fullScreenModeScreens.includes(CachedData.currentScreen);

  const getTargetWidth = () => {
    if (props.sidebarExpanded) return 22;
    return isFullScreenMode ? 0 : 8;
  };

  const animatedWidth = useRef(
    new Animated.Value(getTargetWidth())
  ).current;

  const animatedWidthPercent = animatedWidth.interpolate({
    inputRange: [0, 8, 22],
    outputRange: ["0%", "8%", "22%"]
  });

  useEffect(() => {
    if (props.sidebarExpanded && CachedData.currentScreen) highlightTab(CachedData.currentScreen);

    // Track when sidebar is collapsed to prevent immediate re-expansion from focus events
    if (!props.sidebarExpanded) {
      recentlyCollapsed.current = true;
      setTimeout(() => { recentlyCollapsed.current = false; }, 500);
    }

    // Subtle audio cue on user-initiated open/close (skip the initial mount)
    if (sidebarMounted.current) {
      SoundHelper.playWhoosh();
    } else {
      sidebarMounted.current = true;
    }

    Animated.timing(animatedWidth, {
      toValue: getTargetWidth(),
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [props.sidebarExpanded, CachedData.currentScreen]);

  // Wrapper for sidebarState that respects navigation/loading state
  const handleSidebarExpand = (state: boolean) => {
    // Don't auto-expand via focus on content browser screen or while loading
    if (state && (
      recentlyCollapsed.current ||
      CachedData.preventSidebarExpand ||
      CachedData.currentScreen === "contentBrowser"
    )) return;
    props.sidebarState(state);
  };

  const handleClick = (id: string) => {
    props.navigateTo(id);
  };

  // TV-specific: useTVEventHandler catches DPAD events reliably on TV platforms
  const tvEventHandler = (evt: any) => {
    const eventType = evt && (evt.eventType || evt.eventName || evt.type);
    const keyCode = evt && (evt.keyCode || evt.which);
    const isRight = eventType === "right" || keyCode === 22;
    const isLeft = eventType === "left" || keyCode === 21;

    if (isRight && props.sidebarExpanded) {
      props.sidebarState(false);
    }
    // Explicitly handle LEFT navigation to open sidebar
    if (isLeft && !props.sidebarExpanded) {
      props.sidebarState(true);
    }
  };
  useTVEventHandler(tvEventHandler as any);

  const logoSize = props.sidebarExpanded ? "medium" : "small";
  const showLogoText = props.sidebarExpanded;

  let highlightedItem = "browse";
  const highlightTab = (tab: string) => {
    switch (tab) {
      case "planDownload":
      case "planPairing":
      case "player":
        highlightedItem = "plan";
        break;
      case "contentBrowser":
        highlightedItem = CachedData.activeProvider || "provider";
        break;
      case "settings":
      case "downloads":
      case "providers":
      case "providerSettings":
        highlightedItem = "settings";
        break;
    }
  };
  highlightTab(CachedData.currentScreen);

  // Get connected providers for nav items, hiding any whose Library toggle is off
  const connectedProviders = (CachedData.connectedProviders || []).filter(id => ProviderSettingsHelper.getLibraryEnabledSync(id));

  // Show "Today's Plan" when the device is paired AND that provider can resolve a current plan
  const pairedProvider = CachedData.providerId ? getProvider(CachedData.providerId) : null;
  const showPlanNav = !!(CachedData.providerId && pairedProvider?.getCurrentPlan);

  const showAnnouncements = !!CachedData.announcements?.files?.length;

  // D-pad order of the items currently shown; refs come from the previous render
  const focusOrder = [
    showPlanNav && planRef.current,
    showAnnouncements && announcementsRef.current,
    ...connectedProviders.map(id => providerRefs.current[id]),
    settingsRef.current
  ].filter(Boolean);
  const neighbor = (item: any, offset: number) => {
    const target = item ? focusOrder[focusOrder.indexOf(item) + offset] : null;
    return target ? findNodeHandle(target) : undefined;
  };

  const getContent = () => (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        height: DimensionHelper.hp("100%"),
        width: "100%"
      }}
      accessible={true}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: DimensionHelper.hp("8%"),
            maxWidth: "90%",
            alignSelf: "center",
            marginTop: DimensionHelper.hp("1%"),
            justifyContent: "center"
          }}>
          <FreePlayLogo size={logoSize} showText={showLogoText} />
        </View>
        {showPlanNav && (
          <NavItem
            testID="nav-item-plan"
            icon={"event"}
            text={t("nav.plan")}
            expanded={props.sidebarExpanded}
            setExpanded={handleSidebarExpand}
            selected={highlightedItem === "plan"}
            onPress={() => handleClick("planDownload")}
            ref={planRef}
            nextFocusDown={neighbor(planRef.current, 1)}
          />
        )}
        {showAnnouncements && (
          <NavItem
            testID="nav-item-announcements"
            icon={"campaign"}
            text={t("nav.announcements")}
            expanded={props.sidebarExpanded}
            setExpanded={handleSidebarExpand}
            selected={false}
            onPress={() => {
              CachedData.messageFiles = CachedData.announcements?.files || [];
              props.navigateTo("player", { announcements: true });
            }}
            ref={announcementsRef}
            nextFocusUp={neighbor(announcementsRef.current, -1)}
            nextFocusDown={neighbor(announcementsRef.current, 1)}
          />
        )}
        {connectedProviders.length > 0 && (
          <View style={{ marginTop: DimensionHelper.hp(showPlanNav || showAnnouncements ? "4%" : "1%"), marginHorizontal: DimensionHelper.wp("1%"), height: DimensionHelper.hp("3%"), justifyContent: "center" }}>
            {props.sidebarExpanded
              ? <Text numberOfLines={1} style={{ color: Colors.textSubtle, fontSize: DimensionHelper.wp("1.1%"), letterSpacing: 1.5, paddingLeft: DimensionHelper.wp("1.5%") }}>{t("nav.browse").toUpperCase()}</Text>
              : <View style={{ height: 1, backgroundColor: Colors.borderAccent }} />}
          </View>
        )}
        {connectedProviders.map((providerId: string) => {
          const provider = getProvider(providerId);
          if (!provider) return null;

          return (
            <NavItem
              key={providerId}
              testID={`nav-item-provider-${providerId}`}
              icon={"play-circle-outline"}
              text={provider.name}
              logoUrl={provider.logos?.dark}
              expanded={props.sidebarExpanded}
              setExpanded={handleSidebarExpand}
              selected={highlightedItem === providerId}
              onPress={() => {
                CachedData.activeProvider = providerId;
                props.navigateTo("contentBrowser", { providerId, folderStack: [] });
              }}
              ref={(el: any) => { providerRefs.current[providerId] = el; }}
              nextFocusUp={neighbor(providerRefs.current[providerId], -1)}
              nextFocusDown={neighbor(providerRefs.current[providerId], 1)}
            />
          );
        })}
      </View>
      <View style={{ marginBottom: DimensionHelper.hp("2%") }}>
        <NavItem
          testID="nav-item-settings"
          icon={"settings"}
          text={t("nav.settings")}
          expanded={props.sidebarExpanded}
          setExpanded={handleSidebarExpand}
          selected={highlightedItem === "settings"}
          onPress={() => handleClick("settings")}
          ref={settingsRef}
          nextFocusUp={neighbor(settingsRef.current, -1)}
        />
      </View>
    </View>
  );

  const sidebarHidden = isFullScreenMode && !props.sidebarExpanded;

  // Accent line opacity: visible when collapsed, hidden when expanded or fully hidden
  const accentOpacity = useRef(new Animated.Value(props.sidebarExpanded ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(accentOpacity, {
      toValue: props.sidebarExpanded || sidebarHidden ? 0 : 1,
      duration: 200,
      useNativeDriver: false
    }).start();
  }, [props.sidebarExpanded, sidebarHidden]);

  return (
    <View style={{ display: "flex", flexDirection: "row" }}>
      <Animated.View
        style={{
          width: animatedWidthPercent,
          paddingTop: DimensionHelper.hp("0.5%"),
          backgroundColor: Styles.navAccent.backgroundColor,
          overflow: "hidden"
        }}>
        {!sidebarHidden && getContent()}
      </Animated.View>
      {/* Accent line indicating the sidebar is interactive */}
      <Animated.View
        style={{
          width: 2,
          height: DimensionHelper.hp("100%"),
          backgroundColor: Colors.primary,
          opacity: accentOpacity
        }}
      />
      <View
        style={{
          flex: 1,
          alignItems: "flex-start",
          height: DimensionHelper.hp("100%")
        }}>
        <View
          style={{
            width: sidebarHidden ? DimensionHelper.wp("100%") : DimensionHelper.wp("92%"),
            height: DimensionHelper.hp("100%"),
            backgroundColor: "transparent"
          }}>
          {props.screen}
        </View>
      </View>
    </View>
  );
};
