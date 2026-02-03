import {DimensionHelper} from '../helpers/DimensionHelper';
import {
  Animated,
  Easing,
  View,
  findNodeHandle,
  useTVEventHandler,
} from 'react-native';

import React, {useEffect, useRef} from 'react';
import {CachedData, Styles} from '../helpers';
import {NavItem} from './NavItem';
import {getProvider} from '../providers';
import {FreePlayLogo} from '../components';

type Props = {
  screen: React.JSX.Element;
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const NavWrapper = (props: Props) => {
  const browseRef = useRef(null);
  const providersRef = useRef(null);
  const providerRefs = useRef<{[key: string]: any}>({});
  const recentlyCollapsed = useRef(false);

  // Screens where sidebar fully hides when collapsed
  const fullScreenModeScreens = ['planDownload'];
  const isFullScreenMode = fullScreenModeScreens.includes(CachedData.currentScreen);

  const getTargetWidth = () => {
    if (props.sidebarExpanded) return 22;
    return isFullScreenMode ? 0 : 8;
  };

  const animatedWidth = useRef(
    new Animated.Value(getTargetWidth()),
  ).current;

  const animatedWidthPercent = animatedWidth.interpolate({
    inputRange: [0, 8, 22],
    outputRange: ['0%', '8%', '22%'],
  });

  useEffect(() => {
    if (props.sidebarExpanded && CachedData.currentScreen) highlightTab(CachedData.currentScreen);

    // Track when sidebar is collapsed to prevent immediate re-expansion from focus events
    if (!props.sidebarExpanded) {
      recentlyCollapsed.current = true;
      setTimeout(() => { recentlyCollapsed.current = false; }, 500);
    }

    Animated.timing(animatedWidth, {
      toValue: getTargetWidth(),
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [props.sidebarExpanded, CachedData.currentScreen]);

  // Wrapper for sidebarState that respects navigation/loading state
  const handleSidebarExpand = (state: boolean) => {
    // Don't auto-expand via focus on content browser screen or while loading
    if (state && (
      recentlyCollapsed.current ||
      CachedData.preventSidebarExpand ||
      CachedData.currentScreen === 'contentBrowser'
    )) return;
    props.sidebarState(state);
  };

  const handleClick = (id: string) => {
    props.navigateTo(id);
  };

  const handleChurchClick = () => {
    // If paired to a plan, go directly to plan download screen
    if (CachedData.planTypeId) handleClick('planDownload');
    // If paired to a classroom, show room selection
    else if (CachedData.church) handleClick('selectRoom');
    // Not paired at all, go to church search
    else handleClick('selectChurch');
  };

  // TV-specific: useTVEventHandler catches DPAD events reliably on TV platforms
  const tvEventHandler = (evt: any) => {
    const eventType = evt && (evt.eventType || evt.eventName || evt.type);
    const keyCode = evt && (evt.keyCode || evt.which);
    const isRight = eventType === 'right' || keyCode === 22;
    const isLeft = eventType === 'left' || keyCode === 21;

    if (isRight && props.sidebarExpanded) {
      props.sidebarState(false);
    }
    // Explicitly handle LEFT navigation to open sidebar
    if (isLeft && !props.sidebarExpanded) {
      props.sidebarState(true);
    }
  };
  useTVEventHandler(tvEventHandler as any);

  const logoSize = props.sidebarExpanded ? 'medium' : 'small';
  const showLogoText = props.sidebarExpanded;

  let highlightedItem = 'browse';
  const highlightTab = (tab: string) => {
    switch (tab) {
      case 'selectRoom':
      case 'selectChurch':
      case 'download':
      case 'planDownload':
      case 'player':
        highlightedItem = 'church';
        break;
      case 'providers':
        highlightedItem = 'providers';
        break;
      case 'contentBrowser':
        highlightedItem = CachedData.activeProvider || 'provider';
        break;
    }
  };
  highlightTab(CachedData.currentScreen);

  // Get connected providers for nav items
  const connectedProviders = CachedData.connectedProviders || [];

  const getContent = () => (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: DimensionHelper.hp('100%'),
        width: '100%',
      }}
      accessible={true}>
      <View style={{flex: 1}}>
        <View
          style={{
            height: DimensionHelper.hp('8%'),
            maxWidth: '90%',
            alignSelf: 'center',
            marginTop: DimensionHelper.hp('1%'),
            justifyContent: 'center',
          }}>
          <FreePlayLogo size={logoSize} showText={showLogoText} />
        </View>
        {/* Connected content provider nav items */}
        {connectedProviders.map((providerId: string, index: number) => {
          const provider = getProvider(providerId);
          if (!provider) return null;

          // Determine focus targets
          const prevRef = index === 0 ? null : providerRefs.current[connectedProviders[index - 1]];
          const nextRef = index === connectedProviders.length - 1 ? providersRef.current : providerRefs.current[connectedProviders[index + 1]];

          return (
            <NavItem
              key={providerId}
              icon={'play-circle-outline'}
              text={provider.name}
              logoUrl={provider.logos?.dark}
              expanded={props.sidebarExpanded}
              setExpanded={handleSidebarExpand}
              selected={highlightedItem === providerId}
              onPress={() => {
                CachedData.activeProvider = providerId;
                props.navigateTo('contentBrowser', {providerId, folderStack: []});
              }}
              ref={(el: any) => { providerRefs.current[providerId] = el; }}
              nextFocusUp={prevRef ? findNodeHandle(prevRef) : undefined}
              nextFocusDown={findNodeHandle(nextRef)}
            />
          );
        })}
      </View>
      <View style={{marginBottom: DimensionHelper.hp('2%')}}>
        <NavItem
          icon={'extension'}
          text={'Providers'}
          expanded={props.sidebarExpanded}
          setExpanded={handleSidebarExpand}
          selected={highlightedItem === 'providers'}
          onPress={() => {
            handleClick('providers');
          }}
          ref={providersRef}
          nextFocusUp={
            connectedProviders.length > 0
              ? findNodeHandle(providerRefs.current[connectedProviders[connectedProviders.length - 1]])
              : undefined
          }
        />
      </View>
    </View>
  );

  const sidebarHidden = isFullScreenMode && !props.sidebarExpanded;

  //#29235c
  return (
    <View style={{display: 'flex', flexDirection: 'row'}}>
      <Animated.View
        style={{
          width: animatedWidthPercent,
          paddingTop: DimensionHelper.hp('0.5%'),
          backgroundColor: Styles.navAccent.backgroundColor,
          overflow: 'hidden',
        }}>
        {!sidebarHidden && getContent()}
      </Animated.View>
      <View
        style={{
          flex: 1,
          alignItems: 'flex-start',
          height: DimensionHelper.hp('100%'),
        }}>
        <View
          style={{
            width: sidebarHidden ? DimensionHelper.wp('100%') : DimensionHelper.wp('92%'),
            height: DimensionHelper.hp('100%'),
            backgroundColor: 'transparent',
          }}>
          {props.screen}
        </View>
      </View>
    </View>
  );
};
