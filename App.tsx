import { useCallback, useEffect, useReducer, useRef, useState, Dispatch } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { 
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold
} from "@expo-google-fonts/outfit";
import {
  Animated,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import type { TouchableOpacityProps } from "react-native";
import type { WebView as WebViewType } from "react-native-webview";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import * as SplashScreen from "expo-splash-screen";
import { BannerAdWrapper } from "./utils/BannerAdWrapper";
import {
  autoSubmitFirstSemesterScript,
  parseDetailedAttendanceAndGoHomeScript,
  selectSubjectByIndexScript,
  AttendanceRecord,
  StudentInfo,
  SubjectAttendanceData,
} from "./utils/automationScripts";
import {
  PreviousAttendanceResult,
  loadPreviousResult,
  savePreviousResult,
} from "./utils/storage";
import { shouldCheckOnMount, useUpdateManager } from "./utils/updateManager";
import { useAppOpenAd } from "./utils/appOpenAd";
import { useInterstitialAd } from "./utils/interstitialAd";

/* ------------------------------------------------------------------ */
/*  Glassmorphism over Deep Ocean Gradient Palette                     */
/* ------------------------------------------------------------------ */
const COLORS = {
  canvas: "transparent",
  surfaceCard: "rgba(255, 255, 255, 0.12)",
  creamStrong: "rgba(255, 255, 255, 0.2)",
  surfaceDark: "rgba(0, 0, 0, 0.2)",
  primary: "#22D3EE", // Cyan
  primaryActive: "#06B6D4",
  ink: "#FFFFFF",
  body: "#F8FAFC",
  muted: "#CBD5E1",
  mutedSoft: "#94A3B8",
  hairline: "rgba(255, 255, 255, 0.15)",
  hairlineSoft: "rgba(255, 255, 255, 0.05)",
  onDark: "#FFFFFF",
  onDarkSoft: "#E2E8F0",
  success: "#4ADE80",
  live: "#22D3EE",
  error: "#F87171",
  amber: "#FBBF24",
  overlay: "rgba(15, 23, 42, 0.6)",
};

const FONT_REGULAR = "Outfit_400Regular";
const FONT_MEDIUM = "Outfit_500Medium";
const FONT_SEMIBOLD = "Outfit_600SemiBold";
const FONT_BOLD = "Outfit_700Bold";
const STALL_TIMEOUT_MS = 25000;

const STATUS_COLOR: Record<AttendanceRecord["status"], string> = {
  Present: COLORS.success,
  Absent: COLORS.error,
  Unknown: COLORS.muted,
};

/* ------------------------------------------------------------------ */
/*  Animation Components                                               */
/* ------------------------------------------------------------------ */
const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

function BouncyButton({ onPress, style, children, activeOpacity = 0.9, ...props }: TouchableOpacityProps & { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = (e: any) => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
    if (props.onPressIn) props.onPressIn(e);
  };
  const onPressOut = (e: any) => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    if (props.onPressOut) props.onPressOut(e);
  };
  
  return (
    <AnimatedPressable
      {...props}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={activeOpacity}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

function PulsingText({ style, children }: { style?: any; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [opacity]);
  return <Animated.Text style={[style, { opacity }]}>{children}</Animated.Text>;
}

function FadeInView({ style, children }: { style?: any; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(15)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true })
    ]).start();
  }, [opacity, translateY]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}



/*  State — unchanged workflow                                         */
/* ------------------------------------------------------------------ */
interface AppState {
  webViewKey: number;
  isLoggedIn: boolean;
  studentInfo: StudentInfo | null;
  currentIndex: number;
  totalSubjects: number | null;
  fetchedIndices: number[];
  subjectsData: SubjectAttendanceData[];
  isScrapingFinished: boolean;
  selectedSubject: SubjectAttendanceData | null;
  hasPreviousResult: boolean;
  previousResult: PreviousAttendanceResult | null;
  isSelectionError: boolean;
  isSplashDismissed: boolean;
  gatewayError: boolean;
}

const initialState: AppState = {
  webViewKey: 0,
  isLoggedIn: false,
  studentInfo: null,
  currentIndex: 0,
  totalSubjects: null,
  fetchedIndices: [],
  subjectsData: [],
  isScrapingFinished: false,
  selectedSubject: null,
  hasPreviousResult: false,
  previousResult: null,
  isSelectionError: false,
  isSplashDismissed: false,
  gatewayError: false,
};

function preserveSession(state: AppState, webViewKeyDelta: number): AppState {
  return {
    ...initialState,
    webViewKey: state.webViewKey + webViewKeyDelta,
    hasPreviousResult: state.hasPreviousResult,
    previousResult: state.previousResult,
    isSplashDismissed: state.isSplashDismissed,
  };
}

type AppAction =
  | { type: "RESET" }
  | { type: "SET_LOGGED_IN" }
  | { type: "SET_STUDENT_INFO"; data: StudentInfo }
  | { type: "SET_SUBJECT_COUNT"; count: number }
  | { type: "ADD_ATTENDANCE_ITEM"; data: SubjectAttendanceData }
  | { type: "SET_SCRAPING_FINISHED" }
  | { type: "SET_SELECTED_SUBJECT"; data: SubjectAttendanceData | null }
  | { type: "SET_PREVIOUS_RESULT"; result: PreviousAttendanceResult | null }
  | { type: "HYDRATE_PREVIOUS_RESULT"; data: PreviousAttendanceResult }
  | { type: "SET_SELECTION_ERROR" }
  | { type: "CLEAR_SELECTION_ERROR" }
  | { type: "SET_SPLASH_DISMISSED" }
  | { type: "SET_GATEWAY_ERROR" }
  | { type: "CLEAR_GATEWAY_ERROR" };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "RESET":
      return preserveSession(state, 1);
    case "SET_LOGGED_IN":
      return { ...state, isLoggedIn: true };
    case "SET_STUDENT_INFO":
      return { ...state, studentInfo: action.data };
    case "SET_SUBJECT_COUNT":
      return { ...state, totalSubjects: action.count };
    case "ADD_ATTENDANCE_ITEM": {
      if (state.fetchedIndices.includes(state.currentIndex)) return state;
      const nextIndex = state.currentIndex + 1;
      const finished = state.totalSubjects !== null && nextIndex >= state.totalSubjects;
      return {
        ...state,
        fetchedIndices: [...state.fetchedIndices, state.currentIndex],
        subjectsData: [...state.subjectsData, action.data],
        currentIndex: finished ? state.currentIndex : nextIndex,
        isScrapingFinished: finished ? true : state.isScrapingFinished,
      };
    }
    case "SET_SCRAPING_FINISHED":
      return { ...state, isScrapingFinished: true };
    case "SET_SELECTION_ERROR":
      return { ...state, isSelectionError: true };
    case "CLEAR_SELECTION_ERROR":
      return preserveSession(state, 0);
    case "SET_SELECTED_SUBJECT":
      return { ...state, selectedSubject: action.data };
    case "SET_PREVIOUS_RESULT":
      return { ...state, previousResult: action.result, hasPreviousResult: action.result !== null };
    case "HYDRATE_PREVIOUS_RESULT":
      return {
        ...state,
        isLoggedIn: true,
        isScrapingFinished: true,
        studentInfo: action.data.studentInfo,
        subjectsData: action.data.subjectsData,
        currentIndex: 0,
        totalSubjects: action.data.subjectsData.length,
        fetchedIndices: action.data.subjectsData.map((_, i) => i),
      };
    case "SET_SPLASH_DISMISSED":
      return { ...state, isSplashDismissed: true };
    case "SET_GATEWAY_ERROR":
      return { ...state, gatewayError: true };
    case "CLEAR_GATEWAY_ERROR":
      return preserveSession(state, 0);
    default:
      return state;
  }
}

type MessagePayload =
  | { type: "STUDENT_INFO"; data: StudentInfo }
  | { type: "SUBJECT_COUNT"; count: number }
  | { type: "ATTENDANCE_ITEM"; data: SubjectAttendanceData }
  | { type: "SCRAPING_COMPLETE" };

interface AnimatedSubjectCardProps {
  item: SubjectAttendanceData;
  index: number;
  dispatch: Dispatch<AppAction>;
  getAttendanceColor: (percentage: number) => string;
  calculateCanSkip: (present: number, total: number) => number;
  calculateClassesToReach75: (present: number, total: number) => number;
}

function AnimatedSubjectCard({ item, index, dispatch, getAttendanceColor, calculateCanSkip, calculateClassesToReach75 }: AnimatedSubjectCardProps) {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 400,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [index, opacity, translateY]);

  const pVal = parseFloat(item.percentage);
  const isLow = pVal < 75;
  const canSkip = calculateCanSkip(item.present, item.total);
  const classesToReach75 = calculateClassesToReach75(item.present, item.total);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <BouncyButton
        style={styles.subjectCard}
        activeOpacity={0.75}
        onPress={() => dispatch({ type: "SET_SELECTED_SUBJECT", data: item })}
      >
        <View style={styles.subjectRow1}>
          <Text style={styles.subjectName} numberOfLines={2}>{item.subjectName}</Text>
          <Text style={[styles.subjectPct, { color: getAttendanceColor(pVal) }]}>{item.percentage}%</Text>
        </View>
        <View style={styles.subjectRow2}>
          <Text style={styles.shortStats}>
            Tot <Text style={styles.shortStatsBold}>{item.total}</Text>
            {" · "}Att <Text style={styles.shortStatsBold}>{item.present}</Text>
            {" · "}Abs <Text style={styles.shortStatsBold}>{item.absent}</Text>
          </Text>
          <View style={[styles.badgeCoral, canSkip <= 0 && styles.badgeMute]}>
            <Text style={[styles.badgeCoralText, canSkip <= 0 && styles.badgeMuteText]}>
              {isLow
                ? `Attend ${classesToReach75} more`
                : canSkip > 0
                  ? `Skip ${canSkip} ${canSkip === 1 ? "class" : "classes"}`
                  : "Keep attending"}
            </Text>
          </View>
        </View>
      </BouncyButton>
    </Animated.View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const splashPreventedRef = useRef(false);
  if (!splashPreventedRef.current) {
    splashPreventedRef.current = true;
    void SplashScreen.preventAutoHideAsync();
  }
  const webViewRef = useRef<WebViewType>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [adFailed, setAdFailed] = useState(false);
  const update = useUpdateManager();
  const { checkForUpdate } = update;
  useAppOpenAd(state.isSplashDismissed);
  const { tryShowInterstitial } = useInterstitialAd();

  useEffect(() => {
    if (shouldCheckOnMount()) void checkForUpdate();
    
    // Fallback to hide splash screen in case WebView onLoadStart doesn't fire
    setTimeout(() => {
      if (!stateRef.current.isSplashDismissed && fontsLoaded) {
        dispatch({ type: "SET_SPLASH_DISMISSED" });
        void SplashScreen.hideAsync();
      }
    }, 3500);
  }, [checkForUpdate, fontsLoaded]);

  const {
    webViewKey, isLoggedIn, studentInfo,
    subjectsData, isScrapingFinished, selectedSubject,
    hasPreviousResult, previousResult, isSelectionError,
    gatewayError,
  } = state;

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });
  const lastActivityRef = useRef<number>(Date.now());
  const persistedSigRef = useRef<string | null>(null);

  const handleFullReset = useCallback(() => dispatch({ type: "RESET" }), []);
  const handleCloseModal = useCallback(() => {
    dispatch({ type: "SET_SELECTED_SUBJECT", data: null });
    tryShowInterstitial();
  }, [tryShowInterstitial]);
  const handlePreviousAttendance = useCallback(() => {
    if (previousResult) dispatch({ type: "HYDRATE_PREVIOUS_RESULT", data: previousResult });
  }, [previousResult]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    const { url, loading } = navState;
    const { isLoggedIn: loggedIn, isScrapingFinished: scrapingFinished, currentIndex } = stateRef.current;
    const shouldInject = !loading && !scrapingFinished;
    if (url.includes("studenthome.php")) {
      if (!loggedIn) dispatch({ type: "SET_LOGGED_IN" });
      if (shouldInject) webViewRef.current?.injectJavaScript(autoSubmitFirstSemesterScript);
    } else if (url.includes("studentsubjects.php") && shouldInject) {
      webViewRef.current?.injectJavaScript(selectSubjectByIndexScript(currentIndex));
    } else if (url.includes("studentsubatt.php") && shouldInject) {
      webViewRef.current?.injectJavaScript(parseDetailedAttendanceAndGoHomeScript);
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MessagePayload;
      lastActivityRef.current = Date.now();
      switch (payload.type) {
        case "STUDENT_INFO": dispatch({ type: "SET_STUDENT_INFO", data: payload.data }); break;
        case "SUBJECT_COUNT": dispatch({ type: "SET_SUBJECT_COUNT", count: payload.count }); break;
        case "ATTENDANCE_ITEM": dispatch({ type: "ADD_ATTENDANCE_ITEM", data: payload.data }); break;
        case "SCRAPING_COMPLETE": dispatch({ type: "SET_SCRAPING_FINISHED" }); break;
      }
    } catch (err) {
      console.warn("WebView Message Error:", err);
    }
   }, []);

   useEffect(() => {
     let lastBackPress = 0;
     let subscription: { remove: () => void } | null = null;
     let popstateHandler: (() => void) | null = null;

     const handleBackConsumed = (): boolean => {
       const s = stateRef.current;

       if (s.selectedSubject) {
         dispatch({ type: "SET_SELECTED_SUBJECT", data: null });
         return true;
       }

       if (s.isScrapingFinished && s.isLoggedIn) {
         dispatch({ type: "RESET" });
         return true;
       }

       if (s.isSelectionError && s.isLoggedIn && !s.isScrapingFinished) {
         dispatch({ type: "CLEAR_SELECTION_ERROR" });
         return true;
       }

       return false;
     };

     if (Platform.OS === "android") {
       const onBackPress = (): boolean => {
         if (handleBackConsumed()) return true;

         const now = Date.now();
         if (now - lastBackPress < 2000) {
           BackHandler.exitApp();
           return true;
         }
         lastBackPress = now;
         ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
         return true;
       };

       subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
     } else if (Platform.OS === "web") {
       window.history.replaceState({ nav: "root" }, "", window.location.href);

       popstateHandler = () => {
         handleBackConsumed();
         window.history.pushState({ nav: "root" }, "", window.location.href);
       };

       window.addEventListener("popstate", popstateHandler);
     }

     return () => {
       subscription?.remove();
       if (popstateHandler) {
         window.removeEventListener("popstate", popstateHandler);
       }
     };
   }, []);

   /* Aggregation math */
  const { overallClasses, overallPresent, overallAbsent } = subjectsData.reduce(
    (acc, x) => ({
      overallClasses: acc.overallClasses + x.total,
      overallPresent: acc.overallPresent + x.present,
      overallAbsent: acc.overallAbsent + x.absent,
    }),
    { overallClasses: 0, overallPresent: 0, overallAbsent: 0 },
  );
  const overallPercentageVal = overallClasses > 0 ? (overallPresent / overallClasses) * 100 : 0;
  const overallPercentage = overallPercentageVal.toFixed(1);
  const isShortage = overallPercentageVal < 75;
  const maxOverallSkippable = Math.max(0, Math.floor((4 * overallPresent - 3 * overallClasses) / 3));
  const getAttendanceColor = (percentage: number): string => {
    if (percentage < 75) return COLORS.error;
    if (percentage <= 77) return COLORS.amber;
    return COLORS.success;
  };
  const calculateCanSkip = (p: number, t: number): number =>
    Math.min(Math.max(0, Math.floor((4 * p - 3 * t) / 3)), maxOverallSkippable);
  const calculateClassesToReach75 = (p: number, t: number): number =>
    Math.max(0, 3 * t - 4 * p);

  /* Persist latest result */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadPreviousResult();
      if (!cancelled) dispatch({ type: "SET_PREVIOUS_RESULT", result });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!(isScrapingFinished && isLoggedIn && studentInfo && subjectsData.length > 0)) return;
    const sig = `${studentInfo.name}|${subjectsData.length}|${overallClasses}|${overallPresent}`;
    if (persistedSigRef.current === sig) return;
    persistedSigRef.current = sig;
    const latestResult: PreviousAttendanceResult = { studentInfo, subjectsData };
    void savePreviousResult(latestResult);
    dispatch({ type: "SET_PREVIOUS_RESULT", result: latestResult });
  }, [isScrapingFinished, isLoggedIn, studentInfo, subjectsData, overallClasses, overallPresent]);

  /* Stall detection */
  useEffect(() => {
    if (!isLoggedIn || isScrapingFinished) return;
    lastActivityRef.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > STALL_TIMEOUT_MS) {
        dispatch({ type: "SET_SELECTION_ERROR" });
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn, isScrapingFinished]);



  return (
    <LinearGradient colors={["#0F172A", "#0891B2"]} style={styles.container}>
      {(update.status === "checking" || update.status === "applying") && (
        <View style={styles.updateBanner}>
          <Text style={styles.updateBannerText}>
            {update.status === "applying" ? "Applying update…" : "Checking for updates…"}
          </Text>
        </View>
      )}

      {/* WebView stays full-size until scraping is done — overlays sit ON TOP,
          so the portal page can never flash through while loading. */}
      <View style={isScrapingFinished ? styles.hiddenWebView : styles.fullWebView}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: "https://jntuaceastudents.classattendance.in/" }}
          userAgent="Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onLoadStart={() => {
            if (stateRef.current.gatewayError) dispatch({ type: "CLEAR_GATEWAY_ERROR" });
            if (!stateRef.current.isSplashDismissed && fontsLoaded) {
              dispatch({ type: "SET_SPLASH_DISMISSED" });
              void SplashScreen.hideAsync();
            }
          }}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          onError={(event) => console.warn("WebView error:", event.nativeEvent.description)}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode === 502) dispatch({ type: "SET_GATEWAY_ERROR" });
          }}
          javaScriptEnabled
          domStorageEnabled
          incognito={false}
        />
        {!isLoggedIn && hasPreviousResult && (
          <BouncyButton style={styles.prevBtn} onPress={handlePreviousAttendance} activeOpacity={0.88}>
            <Ionicons name="time" size={18} color={COLORS.onDark} style={{ marginRight: 6 }} />
            <Text style={styles.prevBtnText}>Previous Attendance</Text>
          </BouncyButton>
        )}
      </View>

      {/* ---------- 502 GATEWAY ERROR · opaque overlay with crab ---------- */}
      {gatewayError && (
        <View style={styles.overlayFull}>
          <Text style={styles.syncTitle}>{"Main attendance\nwebsite is not working"}</Text>
          <Text style={styles.syncSub}>The portal is temporarily unavailable (502).</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={handleFullReset}>
            <Text style={styles.errorBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- SYNC · opaque overlay, no webpage flash ---------- */}
      {isLoggedIn && !isScrapingFinished && !isSelectionError && (
        <View style={styles.overlayFull}>
          <PulsingText style={styles.syncTitle}>{"Loading attendance..."}</PulsingText>
        </View>
      )}

      {/* ---------- SELECTION ERROR · opaque overlay ---------- */}
      {isSelectionError && isLoggedIn && !isScrapingFinished && (
        <View style={styles.overlayFull}>
          <View style={styles.errorCard}>
            <TouchableOpacity style={styles.closeIcon} onPress={() => dispatch({ type: "CLEAR_SELECTION_ERROR" })}>
              <Ionicons name="close" size={20} color={COLORS.body} />
            </TouchableOpacity>
            <Ionicons name="alert-circle" size={40} color={COLORS.error} style={{ marginBottom: 10 }} />
            <Text style={styles.errorTitle}>Couldn’t load subjects right now</Text>
            <Text style={styles.errorBody}>
              The attendance portal was recently updated, so the app can’t detect your semester or
              subjects at the moment. This is a temporary issue — we’re working on a fix.
            </Text>
            <BouncyButton style={styles.errorBtn} onPress={handleFullReset}>
              <Text style={styles.errorBtnText}>Try again</Text>
            </BouncyButton>
          </View>
        </View>
      )}

      {/* ---------- DASHBOARD · profile + overall scroll with the list ---------- */}
      {isLoggedIn && isScrapingFinished && (
        <FadeInView style={styles.dashboardContainer}>
          <View style={styles.sigRow}>
            <View style={styles.wordmark}>
              <Ionicons name="star" size={16} color={COLORS.primary} style={{ marginRight: 2 }} />
              <Text style={styles.wordmarkText}>JNTUA</Text>
              <Text style={styles.wordmarkRole}>·Attendance</Text>
            </View>
            <BouncyButton style={styles.iconBtn} onPress={handleFullReset} activeOpacity={0.7}>
              <Ionicons name="refresh" size={18} color={COLORS.body} />
            </BouncyButton>
          </View>

          <FlatList
            style={{ flex: 1 }}
            data={subjectsData}
            keyExtractor={(item, index) => `${item.subjectName}-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListHeaderComponent={
              <View>
                {studentInfo && (
                  <BouncyButton style={styles.profileCard} activeOpacity={0.9}>
                    <Text style={styles.profileName} numberOfLines={1}>{studentInfo.name}</Text>
                    <View style={styles.profileMetaRow}>
                      <View style={styles.liveDot} />
                      <Text style={styles.profileMeta} numberOfLines={1}>
                        {studentInfo.admissionNo} • {studentInfo.className}
                      </Text>
                    </View>
                  </BouncyButton>
                )}

                <View style={styles.overallCard}>
                  <View style={styles.overallTopRow}>
                    <Text style={styles.eyebrowSm}>OVERALL ATTENDANCE</Text>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{isShortage ? "Shortage" : "Semester 1"}</Text>
                    </View>
                  </View>
                  <Text style={[styles.bigPct, { color: getAttendanceColor(overallPercentageVal) }]}>
                    {overallPercentage}
                    <Text style={styles.bigPctSign}>%</Text>
                  </Text>
                  <View style={styles.miniStats}>
                    <View style={styles.miniStat}>
                      <Text style={styles.miniStatNum}>{overallClasses}</Text>
                      <Text style={styles.miniStatLabel}>TOT</Text>
                    </View>
                    <View style={styles.miniDivider} />
                    <View style={styles.miniStat}>
                      <Text style={styles.miniStatNum}>{overallPresent}</Text>
                      <Text style={styles.miniStatLabel}>ATT</Text>
                    </View>
                    <View style={styles.miniDivider} />
                    <View style={styles.miniStat}>
                      <Text style={styles.miniStatNum}>{overallAbsent}</Text>
                      <Text style={styles.miniStatLabel}>ABS</Text>
                    </View>
                  </View>
                  <View style={styles.skipRow}>
                    <View>
                      <Text style={styles.skipTitle}>Overall Safe to skip</Text>
                      <Text style={styles.skipSub}>while staying above 75%</Text>
                    </View>
                    <View style={[styles.badgeCoral, maxOverallSkippable <= 0 && styles.badgeMute]}>
                      <Text style={[styles.badgeCoralText, maxOverallSkippable <= 0 && styles.badgeMuteText]}>
                        {maxOverallSkippable} {maxOverallSkippable === 1 ? "class" : "classes"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.listHead}>
                  <Text style={styles.eyebrowSm}>SUBJECTS</Text>
                  <Text style={styles.listCount}>{subjectsData.length}</Text>
                </View>
              </View>
            }
            ListFooterComponent={
              <View>
                <View style={styles.footBand}>
                  <Ionicons name="star" size={18} color={COLORS.onDark} />
                  <Text style={styles.footTitle}>JNTUA Attendance</Text>
                </View>
              </View>
            }
            renderItem={({ item, index }) => (
              <AnimatedSubjectCard
                item={item}
                index={index}
                dispatch={dispatch}
                getAttendanceColor={getAttendanceColor}
                calculateCanSkip={calculateCanSkip}
                calculateClassesToReach75={calculateClassesToReach75}
              />
            )}
          />
          {!adFailed && (
            <View style={styles.adBanner}>
              <BannerAdWrapper onAdFailedToLoad={() => setAdFailed(true)} />
            </View>
          )}
        </FadeInView>
      )}

      {/* ---------- DATE LOG SHEET ---------- */}
      <Modal
        visible={!!selectedSubject}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {selectedSubject && (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.modalTitle} numberOfLines={2}>{selectedSubject.subjectName}</Text>
                    <Text style={styles.modalSub}>
                      Attendance log · {selectedSubject.present} attended, {selectedSubject.absent} missed
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeIcon} onPress={handleCloseModal}>
                    <Ionicons name="close" size={20} color={COLORS.body} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={selectedSubject.records}
                  keyExtractor={(_, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.logRow}>
                      <View>
                        <Text style={styles.logDate}>{item.date}</Text>
                        {!!item.time && <Text style={styles.logTime}>{item.time}</Text>}
                      </View>
                      <View style={styles.logBadge}>
                        <Text
                          style={[styles.logBadgeText, { color: STATUS_COLOR[item.status] }]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas, paddingTop: 40 },

  updateBanner: {
    backgroundColor: COLORS.surfaceCard,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  updateBannerText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryActive, letterSpacing: 0.3 },

  hiddenWebView: { width: 0, height: 0, overflow: "hidden" },
  fullWebView: { flex: 1 },

  /* Previous attendance — floating coral pill, lifted off the bottom */
  prevBtn: {
    position: "absolute",
    bottom: 56,
    left: 28,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 9999,
    elevation: 6,
    shadowColor: "#181715",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  prevBtnIcon: { color: COLORS.onDark, fontSize: 16, fontWeight: "700", marginRight: 8 },
  prevBtnText: { color: COLORS.onDark, fontWeight: "600", fontSize: 14, letterSpacing: 0.2 },

  /* Opaque full-screen overlays — kill the webpage flash */
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  syncEyebrow: { fontSize: 11, fontWeight: "500", letterSpacing: 1.6, color: COLORS.primary, marginTop: 20 },
  syncTitle: { fontFamily: FONT_BOLD, fontSize: 26, letterSpacing: -0.5, color: COLORS.ink, lineHeight: 31, marginTop: 10, textAlign: "center" },
  syncSub: { fontFamily: FONT_REGULAR, fontSize: 12.5, color: COLORS.muted, marginTop: 8 },
  syncPct: { fontFamily: FONT_BOLD, fontSize: 54, letterSpacing: -2, color: COLORS.primary, lineHeight: 60, marginTop: 16 },
  syncPctSign: { fontSize: 24, color: COLORS.mutedSoft },
  syncFine: { fontSize: 10.5, color: COLORS.mutedSoft, marginTop: 14, letterSpacing: 0.3 },

  errorCard: {
    width: "100%",
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  errorIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.error, color: COLORS.onDark,
    fontSize: 20, fontWeight: "700", textAlign: "center", lineHeight: 34, overflow: "hidden",
  },
  errorTitle: { fontFamily: FONT_BOLD, fontSize: 19, letterSpacing: -0.3, color: COLORS.ink, marginTop: 12, textAlign: "center" },
  errorBody: { fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: COLORS.muted, marginTop: 8, textAlign: "center" },
  errorBtn: { backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: 12, alignSelf: "stretch", alignItems: "center", marginTop: 16 },
  errorBtnText: { fontFamily: FONT_MEDIUM, color: COLORS.onDark, fontSize: 14 },
  closeIcon: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.hairline,
    backgroundColor: COLORS.canvas, alignItems: "center", justifyContent: "center",
  },
  closeIconText: { fontSize: 13, color: COLORS.body, fontWeight: "600" },

  /* Dashboard */
  dashboardContainer: { flex: 1, paddingHorizontal: 20 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, marginBottom: 4 },
  wordmark: { flexDirection: "row", alignItems: "center" },
  wordmarkText: { fontFamily: FONT_BOLD, fontStyle: "italic", fontSize: 23, letterSpacing: -0.4, color: COLORS.ink, marginLeft: 8 },
  wordmarkRole: { fontFamily: FONT_MEDIUM, fontSize: 10, letterSpacing: 1.4, color: COLORS.mutedSoft, marginLeft: 7, marginTop: 4 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.canvas,
    borderWidth: 1, borderColor: COLORS.hairline, alignItems: "center", justifyContent: "center",
  },
  iconBtnText: { fontSize: 15, color: COLORS.body, fontWeight: "600" },

  profileCard: { backgroundColor: COLORS.surfaceDark, borderRadius: 12, padding: 18, marginBottom: 12 },
  profileName: { fontFamily: FONT_SEMIBOLD, fontSize: 24, letterSpacing: -0.5, color: COLORS.onDark },
  profileMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.live, marginRight: 7 },
  profileMeta: { fontFamily: FONT_REGULAR, fontSize: 12.5, color: COLORS.onDarkSoft },

  overallCard: { backgroundColor: COLORS.surfaceCard, borderRadius: 12, padding: 20, marginBottom: 12 },
  overallTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  eyebrowSm: { fontSize: 10.5, fontWeight: "500", letterSpacing: 1.5, color: COLORS.muted },
  badgePill: { backgroundColor: COLORS.creamStrong, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  badgePillText: { fontFamily: FONT_MEDIUM, fontSize: 11, color: COLORS.ink },
  bigPct: { fontFamily: FONT_BOLD, fontSize: 52, letterSpacing: -1.5, color: COLORS.ink, lineHeight: 56, marginVertical: 4 },
  bigPctSign: { fontFamily: FONT_MEDIUM, fontSize: 24, color: COLORS.muted },
  miniStats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 12, marginTop: 8 },
  miniStat: { flex: 1, alignItems: "center" },
  miniStatNum: { fontFamily: FONT_SEMIBOLD, fontSize: 18, color: COLORS.body },
  miniStatLabel: { fontFamily: FONT_MEDIUM, fontSize: 9.5, letterSpacing: 1.2, color: COLORS.muted, marginTop: 3 },
  miniDivider: { width: 1, backgroundColor: COLORS.hairlineSoft },
  skipRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.hairline, marginTop: 12, paddingTop: 12 },
  skipTitle: { fontFamily: FONT_MEDIUM, fontSize: 13, color: COLORS.body },
  skipSub: { fontFamily: FONT_REGULAR, fontSize: 10.5, color: COLORS.muted, marginTop: 2 },

  badgeCoral: { backgroundColor: COLORS.primary, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeCoralText: { fontFamily: FONT_MEDIUM, fontSize: 11, letterSpacing: 0.4, color: COLORS.onDark },
  badgeMute: { backgroundColor: COLORS.creamStrong },
  badgeMuteText: { color: COLORS.muted },

  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginVertical: 8, paddingHorizontal: 2 },
  listCount: { fontSize: 12, color: COLORS.mutedSoft },

  subjectCard: {
    backgroundColor: COLORS.surfaceCard, borderWidth: 1, borderColor: COLORS.hairline,
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  subjectRow1: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  subjectName: { flex: 1, fontSize: 14.5, fontWeight: "500", color: COLORS.ink, lineHeight: 20, marginRight: 10 },
  subjectPct: { fontFamily: FONT_BOLD, fontSize: 24, letterSpacing: -0.5, color: COLORS.ink },
  subjectRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  shortStats: { fontSize: 11.5, color: COLORS.muted },
  shortStatsBold: { fontWeight: "600", color: COLORS.body },

  adBanner: {
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 4,
  },

  footBand: { backgroundColor: COLORS.surfaceDark, borderRadius: 12, padding: 24, alignItems: "center", marginTop: 6, marginBottom: 8 },
  footTitle: { fontFamily: FONT_SEMIBOLD, fontSize: 21, letterSpacing: -0.3, color: COLORS.onDark, marginTop: 10 },
  footSub: { fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 19, color: COLORS.onDarkSoft, marginTop: 8, textAlign: "center" },
  btnCoral: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, marginTop: 14, alignSelf: "stretch", alignItems: "center" },
  btnCoralText: { fontFamily: FONT_MEDIUM, fontSize: 14, color: COLORS.onDark },
  footCredit: { fontFamily: FONT_REGULAR, fontSize: 11.5, color: COLORS.mutedSoft, marginTop: 14 },
  footCreditName: { fontFamily: FONT_SEMIBOLD, fontStyle: "italic", fontSize: 13, color: COLORS.primary },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, maxHeight: "78%",
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.creamStrong, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft, marginBottom: 4 },
  modalTitle: { fontFamily: FONT_SEMIBOLD, fontSize: 19, letterSpacing: -0.3, color: COLORS.ink, lineHeight: 24 },
  modalSub: { fontFamily: FONT_REGULAR, fontSize: 12, color: COLORS.muted, marginTop: 4 },
  logRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft },
  logDate: { fontFamily: FONT_MEDIUM, fontSize: 13, color: COLORS.ink },
  logTime: { fontFamily: FONT_REGULAR, fontSize: 11.5, color: COLORS.mutedSoft, marginTop: 2 },
  logBadge: { backgroundColor: COLORS.surfaceCard, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  logBadgeText: { fontFamily: FONT_MEDIUM, fontSize: 11 },
});
