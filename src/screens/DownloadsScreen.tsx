import React, { useEffect } from "react";
import { Image, View, Text, FlatList, TouchableHighlight, BackHandler } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { DownloadedLessonInterface } from "../interfaces";
import { CachedData, Styles, Colors, DownloadIndex } from "../helpers";
import { PlayerHelper } from "../helpers/PlayerHelper";
import { MenuHeader, EmptyState, SkeletonCard } from "../components";

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const DownloadsScreen = (props: Props) => {
  const [downloads, setDownloads] = React.useState<DownloadedLessonInterface[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [focusedKey, setFocusedKey] = React.useState<string | null>(null);

  const styles: any = {
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
    setLoading(true);
    DownloadIndex.getVerifiedEntries(true).then(entries => {
      setDownloads(entries);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  const handleSelect = (entry: DownloadedLessonInterface) => {
    CachedData.messageFiles = entry.messageFiles;
    CachedData.setAsyncStorage("messageFiles", entry.messageFiles);
    if (entry.playlist) {
      CachedData.setAsyncStorage("playlist", entry.playlist);
    }
    PlayerHelper.pendingPause = false;
    props.navigateTo("player", { downloadedLesson: true });
  };

  const handleDelete = async (entry: DownloadedLessonInterface) => {
    await DownloadIndex.deleteFiles(entry);
    await DownloadIndex.removeEntry(entry.downloadKey);
    setDownloads(prev => prev.filter(d => d.downloadKey !== entry.downloadKey));
  };

  const getCard = (data: any) => {
    const entry = data.item as DownloadedLessonInterface;
    const isFocused = focusedKey === entry.downloadKey;

    return (
      <TouchableHighlight
        style={{ ...styles.item }}
        underlayColor={Colors.pressedBackground}
        onPress={() => { handleSelect(entry); }}
        onFocus={() => setFocusedKey(entry.downloadKey)}
        onBlur={() => setFocusedKey(null)}
        hasTVPreferredFocus={!props.sidebarExpanded && data.index === 0 && focusedKey !== entry.downloadKey}
        onLongPress={() => { handleDelete(entry); }}
      >
        <View style={{
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: isFocused ? Colors.primary : "transparent",
          transform: isFocused ? [{ scale: 1.03 }] : [{ scale: 1 }]
        }}>
          {entry.lessonImage ? (
            <Image
              style={{ height: DimensionHelper.hp("25%"), width: "100%", borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
              resizeMode="cover"
              source={{ uri: entry.lessonImage }}
            />
          ) : (
            <View style={{ height: DimensionHelper.hp("25%"), width: "100%", borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: Colors.backgroundCard, justifyContent: "center", alignItems: "center" }}>
              <Icon name="file-download" size={DimensionHelper.wp("4%")} color={Colors.textLight} />
            </View>
          )}
          <View style={{ padding: 8, backgroundColor: Colors.backgroundCard }}>
            {entry.lessonName ? <Text style={{ ...Styles.smallWhiteText }} numberOfLines={1}>{entry.lessonName}</Text> : null}
            {entry.lessonTitle ? <Text style={{ ...Styles.smallerWhiteText, color: Colors.textLight }} numberOfLines={1}>{entry.lessonTitle}</Text> : null}
          </View>
          {isFocused && (
            <TouchableHighlight
              style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 16, padding: 4 }}
              underlayColor="rgba(255,0,0,0.6)"
              onPress={() => { handleDelete(entry); }}
            >
              <Icon name="delete" size={DimensionHelper.wp("1.5%")} color="#fff" />
            </TouchableHighlight>
          )}
        </View>
      </TouchableHighlight>
    );
  };

  const getCards = () => {
    if (loading) {
      const skeletonData = Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}` }));
      return (
        <View style={styles.list}>
          <FlatList data={skeletonData} numColumns={3} keyExtractor={item => item.id} renderItem={() => (
            <View style={{ ...styles.item, padding: 10 }}>
              <SkeletonCard width="100%" height={DimensionHelper.hp("33%")} />
            </View>
          )} />
        </View>
      );
    }
    if (downloads.length === 0) return <EmptyState icon="file-download" message="No downloads yet" />;
    return (
      <View style={styles.list}>
        <FlatList
          data={downloads}
          numColumns={3}
          renderItem={getCard}
          keyExtractor={(item) => item.downloadKey}
        />
      </View>
    );
  };

  const handleBack = () => {
    props.sidebarState(true);
  };

  const init = () => {
    loadData();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { handleBack(); return true; });
    return () => backHandler.remove();
  };

  useEffect(init, []);

  return (
    <View style={{ ...Styles.menuScreen }}>
      <MenuHeader headerText="Downloads" />
      <View style={{ ...Styles.menuWrapper, flex: 90 }}>
        {getCards()}
      </View>
    </View>
  );
};
