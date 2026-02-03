import React from "react"
import { Styles } from "../helpers";
import { View, Text, FlatList, ListRenderItem, TouchableHighlight } from "react-native";
import { CachedData } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { MenuHeader } from "./MenuHeader";
type Props = { onSelect: (index: number) => void };

export const SelectMessage = (props: Props) => {

  const renderItem: ListRenderItem<{ index: number, name: string }> = (data) => (
    <TouchableHighlight style={Styles.menuClickable} underlayColor={"#E91E63"} onPress={() => { props.onSelect(data.item.index) }}>
      <Text style={Styles.whiteText}>{data.item.name}</Text>
    </TouchableHighlight>
  )

  const determineMessages = () => {
    const result: { index: number, name: string }[] = []
    let idx = 0;
    for (const m of CachedData.messageFiles) {
      result.push({ index: idx, name: m.name });
      idx++;
    }
    return result;
  }

  const messages = determineMessages();

  return (
    <View style={Styles.menuScreen}>
      <MenuHeader headerText="Select a Message" />
      <View style={Styles.menuWrapper}>
        <FlatList data={messages} renderItem={renderItem} keyExtractor={(item) => item.index.toString() || ""} style={{ width: DimensionHelper.wp("100%") }}></FlatList>
      </View>
    </View>
  )
}
