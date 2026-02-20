import React, { useEffect } from "react";
import { CachedData, Styles } from "../helpers";
import { DownloadScreen, SelectChurchScreen, SelectRoomScreen, SplashScreen, PlayerScreen, SelectPairingModeScreen, PlanPairingScreen, PlanDownloadScreen, ContentBrowserScreen, ProviderDeviceAuthScreen, ProvidersScreen, ProviderFormLoginScreen, ProviderOAuthScreen, ProviderDownloadScreen } from "../screens";
import { ProgramsScreen } from "../screens/ProgramsScreen";
import { StudiesScreen } from "../screens/StudiesScreen";
import { LessonsScreen } from "../screens/LessonsScreen";
import { LessonDetailsScreen } from "../screens/LessonDetailsScreen";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { View, Platform, TVEventControl } from "react-native";
import { NavWrapper } from "./NavWrapper";
import { OfflineScreen } from "../screens/OfflineScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";

export const Navigator = () => {
  const [currentScreen, setCurrentScreen] = React.useState("splash");
  const [currentData, setCurrentData] = React.useState<any>(null);
  const [dimensions, setDimensions] = React.useState("1,1");
  const [sidebarExpanded, setSidebarState] = React.useState(false);

  const handleNavigate = (page: string, data?:any) => {
    if (data) setCurrentData(data); else setCurrentData(null);
    setCurrentScreen(page);
    CachedData.currentScreen = page;
  };

  const sidebarState = (state: boolean = true) => {
    setSidebarState(state);
  };

  let screen = <></>;
  switch (currentScreen) {
    case "splash": screen = (<SplashScreen navigateTo={handleNavigate} />); break;
    case "selectPairingMode": screen = (<SelectPairingModeScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;
    case "selectChurch": screen = (<SelectChurchScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;
    case "selectRoom": screen = (<SelectRoomScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;
    case "planPairing": screen = (<PlanPairingScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;
    case "planDownload": screen = (<PlanDownloadScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;
    case "offline": screen = (<OfflineScreen navigateTo={handleNavigate} />); break;
    case "download": screen = (<DownloadScreen navigateTo={handleNavigate} />); break;
    case "player": screen = (<PlayerScreen navigateTo={handleNavigate} program={currentData?.program} study={currentData?.study} lesson={currentData?.lesson} providerId={currentData?.providerId} providerStartIndex={currentData?.providerStartIndex} />); break;

    // Content Provider screens
    case "contentBrowser": screen = (<ContentBrowserScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} providerId={currentData?.providerId} folderStack={currentData?.folderStack} />); break;
    case "providerDeviceAuth": screen = (<ProviderDeviceAuthScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} providerId={currentData?.providerId} />); break;
    case "providerFormLogin": screen = (<ProviderFormLoginScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} providerId={currentData?.providerId} />); break;
    case "providerOAuth": screen = (<ProviderOAuthScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} providerId={currentData?.providerId} />); break;
    case "providerDownload": screen = (<ProviderDownloadScreen navigateTo={handleNavigate} providerId={currentData?.providerId} coverImage={currentData?.coverImage} title={currentData?.title} description={currentData?.description} startIndex={currentData?.startIndex ?? 0} folderStack={currentData?.folderStack} />); break;
    case "providers": screen = (<ProvidersScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;

    case "programs": screen = (<ProgramsScreen navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />); break;
    case "studies": screen = (<StudiesScreen navigateTo={handleNavigate} program={currentData?.program} />); break;
    case "lessons": screen = (<LessonsScreen navigateTo={handleNavigate} program={currentData?.program} study={currentData?.study} />); break;
    case "lessonDetails": screen = (<LessonDetailsScreen navigateTo={handleNavigate} program={currentData?.program} study={currentData?.study} lesson={currentData?.lesson} />); break;
    case "PrivacyPolicy": screen = (<PrivacyPolicyScreen navigateTo={handleNavigate} /> ); break;
  }

  const viewStyle = {};

  const init = () => {
    // Enable TV Menu key handling on tvOS so it triggers BackHandler instead of exiting the app
    if (Platform.isTV) {
      TVEventControl.enableTVMenuKey();
    }

    DimensionHelper.listenOrientationChange(this, () => {
      setDimensions(DimensionHelper.wp("100%") + "," + DimensionHelper.hp("100%"));
    });

    return destroy;
  };

  const destroy = () => {
    if (Platform.isTV) {
      TVEventControl.disableTVMenuKey();
    }
    DimensionHelper.removeOrientationListener();
    //Dimensions.removeEventListener('change', () => {});
  };

  useEffect(init, []);
  if (dimensions !== "1,1") console.log(dimensions);

  const fullScreenScreens = ["splash", "player", "download", "lessonDetails", "providerDownload"];

  if (fullScreenScreens.indexOf(currentScreen) > -1) {
    return (<View style={Styles.splashMaincontainer}>
      <View style={[viewStyle]}>
        {screen}
      </View>
    </View>);
  } else {
    return (<View style={Styles.maincontainer}>
      <NavWrapper screen={screen} navigateTo={handleNavigate} sidebarState={sidebarState} sidebarExpanded={sidebarExpanded} />
    </View>);
  }

};
