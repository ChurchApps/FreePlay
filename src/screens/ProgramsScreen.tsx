import React, { useEffect } from "react";
import { Image, View, FlatList, TouchableHighlight, ActivityIndicator, BackHandler } from "react-native";
import { ApiHelper } from "../helpers/ApiHelper";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { ProgramInterface } from "../interfaces";
import { Styles, Colors } from "../helpers";
import { MenuHeader } from "../components";

type Props = { navigateTo(page: string, data?:any): void; sidebarState: (state: boolean) => void; sidebarExpanded?: boolean; };

export const ProgramsScreen = (props: Props) => {

  const [programs, setPrograms] = React.useState<ProgramInterface[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState(null);

  const styles:any = {
    list: {
      flex: 1,
      marginHorizontal: "auto",
      width: "100%",
      paddingHorizontal: DimensionHelper.wp("1%")
    },
    item: {
      flex: 1,
      maxWidth: "33%",
      alignItems: "center",
      padding: 10,
      borderRadius: 12
    }
  };


  const loadData = () => {
    ApiHelper.get("/programs/public", "LessonsApi").then(data => { setPrograms(data); setLoading(false); });
  };

  const handleSelect = (program: ProgramInterface) => {
    props.navigateTo("studies", { program: program });
  };

  const getCard = (data:any) => {
    const program = data.item as ProgramInterface;
    const isFocused = focusedId === data.id;

    return (
      <TouchableHighlight
        style={{ ...styles.item }}
        underlayColor={Colors.pressedBackground}
        onPress={() => { handleSelect(program); }}
        onFocus={() => setFocusedId(data.id)}
        onBlur={() => setFocusedId(null)}
        hasTVPreferredFocus={!props.sidebarExpanded && data.index === 0 && focusedId !== data.id}
      >
        <View style={{
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: isFocused ? 3 : 0,
          borderColor: Colors.primary,
          transform: isFocused ? [{ scale: 1.02 }] : [{ scale: 1 }]
        }}>
          {program.image ? (
            <Image
              style={{ height: DimensionHelper.hp("33%"), width: "100%", borderRadius: isFocused ? 9 : 12 }}
              resizeMode="cover"
              source={{ uri: program.image }}
            />
          ) : (
            <View style={{ height: DimensionHelper.hp("33%"), width: "100%", borderRadius: isFocused ? 9 : 12, backgroundColor: Colors.backgroundCard }} />
          )}
        </View>
      </TouchableHighlight>
    );
  };

  const getCards = () => {
    if (loading) return <ActivityIndicator size="small" color="gray" animating={loading} />;
    else {
      return (
        <View style={styles.list}>
          <FlatList
            data={programs}
            numColumns={3}
            renderItem={getCard}
            keyExtractor={(item) => item.id}
          />
        </View>
      );
    }
  };


  const handleBack = () => {
    // props.navigateTo("splash");
    props.sidebarState(true);
  };

  const init = () => {
    // Utilities.trackEvent("Program Screen");
    loadData();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { handleBack(); return true; });
    return () => backHandler.remove();
  };

  useEffect(init, []);

  return (
    <View style={{ ...Styles.menuScreen }}>
      <MenuHeader headerText="Browse Programs" />
      <View style={{ ...Styles.menuWrapper, flex: 90 }}>
        {getCards()}
      </View>
    </View>
  );


};
