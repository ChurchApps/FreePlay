import React, { useRef, useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Styles, Colors } from "../helpers";
import { View, Text, Image, FlatList, ListRenderItem, TouchableHighlight, StyleSheet } from "react-native";
import { CachedData } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { MenuHeader } from "./MenuHeader";
import Icon from "react-native-vector-icons/MaterialIcons";

type Props = { onSelect: (index: number) => void; currentIndex?: number };

type MessageItem = { index: number; name: string; image?: string; url?: string; fileType?: string };

const styles = StyleSheet.create({
  maincard: { width: "33.33%" },
  card: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden"
  },
  cardInner: {
    width: "100%",
    borderRadius: 12,
    padding: 8,
    overflow: "hidden"
  },
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8
  },
  textContainer: {
    borderRadius: 8,
    padding: 10,
    backgroundColor: Colors.backgroundCard,
    alignItems: "center"
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.textPrimary,
    textAlign: "center"
  },
  imagePlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  nowPlayingBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.success,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  nowPlayingBadgeText: {
    color: "#fff",
    fontSize: DimensionHelper.wp("1.2%"),
    fontWeight: "700",
    marginLeft: 4,
    letterSpacing: 0.5
  }
});

export const SelectMessage = (props: Props) => {
  const { t } = useTranslation();
  const firstItemRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const messages = useMemo(() => {
    if (!CachedData.messageFiles) return [];
    return CachedData.messageFiles.map((m, idx) => ({
      index: idx,
      name: m.name || "",
      image: m.image,
      url: m.url,
      fileType: m.fileType
    }));
  }, []);

  const handleSelect = useCallback((index: number) => {
    props.onSelect(index);
  }, [props.onSelect]);

  const renderItem: ListRenderItem<MessageItem> = useCallback((data) => {
    const isVideo = data.item.fileType === "video";
    const thumbnail = data.item.fileType === "image" && data.item.url
      ? data.item.url
      : (data.item.image || undefined);
    const isFocused = focusedIndex === data.item.index;
    const isCurrent = props.currentIndex === data.item.index;
    const shouldFocus = props.currentIndex !== undefined ? data.item.index === props.currentIndex : data.index === 0;
    return (
      <View style={styles.maincard}>
        <TouchableHighlight
          style={[
            styles.card,
            isFocused ? {
              borderWidth: 2,
              borderColor: Colors.primary,
              transform: [{ scale: 1.03 }]
            } : isCurrent ? {
              borderWidth: 2,
              borderColor: Colors.success
            } : { borderWidth: 2, borderColor: "transparent" }
          ]}
          hasTVPreferredFocus={shouldFocus}
          focusable={true}
          ref={data.index === 0 ? firstItemRef : null}
          underlayColor={Colors.pressedBackground}
          onPress={() => handleSelect(data.item.index)}
          onFocus={() => setFocusedIndex(data.item.index)}
          onBlur={() => setFocusedIndex(prev => prev === data.item.index ? null : prev)}
        >
          <View style={styles.cardInner}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} resizeMode="cover" style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Icon
                  name={isVideo ? "play-circle-outline" : "image"}
                  size={DimensionHelper.wp("3%")}
                  color="rgba(255,255,255,0.7)"
                />
              </View>
            )}
            {isCurrent && (
              <View style={styles.nowPlayingBadge}>
                <Icon name="play-arrow" size={DimensionHelper.wp("1.4%")} color="#fff" />
                <Text style={styles.nowPlayingBadgeText}>{t("selectMessage.nowPlaying")}</Text>
              </View>
            )}
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{data.item.name}</Text>
            </View>
          </View>
        </TouchableHighlight>
      </View>
    );
  }, [handleSelect, focusedIndex, props.currentIndex, t]);

  return (
    <View style={Styles.menuScreen}>
      <MenuHeader headerText={t("selectMessage.header")} />
      <View style={Styles.menuWrapper}>
        <FlatList
          data={messages}
          numColumns={3}
          renderItem={renderItem}
          keyExtractor={(item) => item.index.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          removeClippedSubviews={false}
          style={{ width: DimensionHelper.wp("100%") }}
        />
      </View>
    </View>
  );
};
