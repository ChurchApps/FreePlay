//import AsyncStorage from "@react-native-community/async-storage";
import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableHighlight,
  ListRenderItem,
  TextInput,
  ActivityIndicator,
  BackHandler,
  useTVEventHandler
} from "react-native";
import { ApiHelper } from "../helpers/ApiHelper";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { ChurchInterface } from "../interfaces";
import { CachedData, Styles, Utilities, Colors } from "../helpers";
import { MenuHeader } from "../components";

type Props = {
  navigateTo(page: string): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
};

export const SelectChurchScreen = (props: Props) => {
  const [churches, setChurches] = React.useState<ChurchInterface[]>([]);
  const [searchText, setSearchText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [autoFocus, setAutoFocus] = React.useState(false);

  const [isInputFocus, setIsInputFocus] = React.useState(false);

  const textRef = React.useRef<TextInput | null>(null);

  const searchApiCall = (text: string) => {
    if (text.length < 4) {
      setChurches([]);
    } else {
      setLoading(true);
      ApiHelper.getAnonymous(
        "/churches/search/?name=" + text + "&app=Lessons&include=logoSquare",
        "MembershipApi"
      ).then(data => {
        setLoading(false);
        setChurches(data);
      }).catch((err) => {
        setLoading(false);
        console.error("Failed to search churches:", err);
      });
    }
  };

  const handleSelect = (church: ChurchInterface) => {
    CachedData.church = church;
    CachedData.setAsyncStorage("church", church).then(() => {
      props.navigateTo("selectRoom");
    });
  };

  const renderItem: ListRenderItem<ChurchInterface> = data => {
    const church = data.item;
    return (
      <TouchableHighlight
        style={Styles.menuClickable}
        underlayColor={Colors.activeBackground}
        onPress={() => {
          handleSelect(church);
        }}>
        <Text style={{ ...Styles.smallWhiteText, paddingVertical: 6 }}>
          {church.name}
        </Text>
      </TouchableHighlight>
    );
  };

  const getNoResultsMessage = () => {
    if (searchText.length < 4) return "Enter at least four letters of your church name to start searching.";
    else return "No results found.  Search again or register your church at https://freeplay.church/.";
  };

  const getSearchResult = () => {
    if (loading) {
      return (
        <ActivityIndicator size="small" color="gray" animating={loading} />
      );
    }
    if (churches.length > 0) {
      return (
        <FlatList
          hasTVPreferredFocus={!props.sidebarExpanded && !isInputFocus}
          data={churches}
          renderItem={renderItem}
          keyExtractor={item => item.id?.toString() || ""}
          style={{ width: DimensionHelper.wp("100%") }}></FlatList>
      );
    } else {
      return (
        <>
          <Text style={{ ...Styles.smallWhiteText, width: "100%" }}>
            {getNoResultsMessage()}
          </Text>
        </>
      );
    }
  };

  const handleBack = () => {
    CachedData.church = null;
    props.navigateTo("planPairing");
  };

  const init = () => {
    Utilities.trackEvent("Select Church Screen");
    if (textRef.current && !props.sidebarExpanded) {
      setTimeout(() => {
        setAutoFocus(true);
      }, 1000);
    }

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  };

  useEffect(() => {
    searchApiCall(searchText);
  }, [searchText]);
  useEffect(init, []);
  useEffect(() => {
    if (autoFocus && !props.sidebarExpanded) {
      setTimeout(() => textRef.current?.focus());
    }
  }, [autoFocus]);
  useEffect(() => {
    if (!props.sidebarExpanded) setAutoFocus(true);
  }, [props.sidebarExpanded]);

  const handleTVKeyPress = (evt: any) => {
    if (evt.eventType === "select" && !isInputFocus) {
      textRef.current?.focus();
    }
  };

  useTVEventHandler(handleTVKeyPress);

  return (
    <View style={Styles.menuScreen}>
      <MenuHeader headerText="Find Your Church" />
      <View
        style={{
          ...Styles.menuWrapper,
          flex: 5,
          alignItems: "center",
          justifyContent: "center"
        }}
        hasTVPreferredFocus={!props.sidebarExpanded}>
        <TextInput
          ref={r => { textRef.current = r; }}
          autoFocus={!props.sidebarExpanded && autoFocus}
          hasTVPreferredFocus={!props.sidebarExpanded}
          onFocus={() => setIsInputFocus(true)}
          onBlur={() => setIsInputFocus(false)}
          style={[
            Styles.textInputStyle,
            isInputFocus && Styles.textInputStyleFocus,
            {
              marginTop: DimensionHelper.hp("2%"),
              marginBottom: DimensionHelper.hp("2%")
            }
          ]}
          placeholder={"Search church name"}
          placeholderTextColor={"#7b8794"}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          selectionColor={Colors.primary}
          value={searchText}
          onChangeText={text => setSearchText(text)}
          returnKeyType="search"
        />
      </View>
      <View style={{ ...Styles.menuWrapper, flex: 20 }}>{getSearchResult()}</View>
    </View>
  );
};
