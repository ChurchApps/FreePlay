
import React, { useEffect } from "react";
import { Image, View, Text, FlatList, TouchableHighlight, BackHandler } from "react-native";
import { ApiHelper } from "../helpers/ApiHelper";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { LessonInterface, ProgramInterface, StudyInterface } from "../interfaces";
import { Styles } from "../helpers";
import { MenuHeader, EmptyState, SkeletonCard } from "../components";

type Props = { navigateTo(page: string, data?:any): void; program: ProgramInterface, study: StudyInterface };

export const LessonsScreen = (props: Props) => {

  const [lessons, setLessons] = React.useState<LessonInterface[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState(null);

  const styles:any = {
    list: {
      flex: 1,
      marginHorizontal: "auto",
      width: "100%"
    },
    item: {
      flex: 1,
      maxWidth: "33%",
      alignItems: "center",
      padding: 7,
      borderRadius: 10
    }
  };

  const loadData = () => {
    ApiHelper.get("/lessons/public/study/" + props.study.id, "LessonsApi").then(data => { setLessons(data); setLoading(false); });
  };

  const handleSelect = (lesson: LessonInterface) => {
    props.navigateTo("lessonDetails", { program: props.program, study: props.study, lesson: lesson });
  };

  const getCard = (data:any) => {
    const lesson = data.item as LessonInterface;

    return (
      <TouchableHighlight style={{ ...styles.item }} underlayColor={"rgba(233, 30, 99, 0.8)"} onPress={() => { handleSelect(lesson); }}onFocus={() => setFocusedId(data.id)} hasTVPreferredFocus={data.index === 0 && focusedId !== data.id}>
        <View style={{ width: "100%" }}>
          {lesson.image ? (
            <Image style={{ height: DimensionHelper.hp("33%"), width: "100%", borderRadius: 8 }} resizeMode="cover" source={{ uri: lesson.image }} />
          ) : (
            <View style={{ height: DimensionHelper.hp("33%"), width: "100%", borderRadius: 8, backgroundColor: "#2d1f2d" }} />
          )}
          <Text style={{ ...Styles.smallWhiteText, alignSelf: "center" }}>{lesson.title}</Text>
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
            <View style={{ ...styles.item, padding: 7 }}>
              <SkeletonCard width="100%" height={DimensionHelper.hp("33%")} />
            </View>
          )} />
        </View>
      );
    }
    if (lessons.length === 0) return <EmptyState icon="library-books" message="No lessons available" />;
    return (
      <View style={styles.list}>
        <FlatList
          data={lessons}
          numColumns={3}
          renderItem={getCard}
          keyExtractor={(item) => item.id}
        />
      </View>
    );
  };

  const handleBack = () => {
    props.navigateTo("studies", { program: props.program });
  };

  const init = () => {
    // Utilities.trackEvent("Lessons Screen");
    loadData();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { handleBack(); return true; });
    return () => backHandler.remove();
  };

  useEffect(init, []);

  return (
    <View style={Styles.menuScreen}>
      <MenuHeader headerText="Select a Lesson" />

      <View style={{ ...Styles.menuWrapper, flex: 20 }}>
        {getCards()}
      </View>

    </View>
  );

};
