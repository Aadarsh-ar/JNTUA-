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
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import type { GestureResponderEvent, StyleProp, TextStyle, TouchableOpacityProps, ViewStyle } from "react-native";
import type { WebView as WebViewType } from "react-native-webview";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import * as SplashScreen from "expo-splash-screen";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { BannerAdWrapper } from "./utils/BannerAdWrapper";
import { PopunderAdWrapper } from "./utils/PopunderAdWrapper";
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
import { useMobileAdsInit } from "./utils/adInit";
import {
  ImportantPdfItem,
  DocumentFileType,
  loadImportantPdfs,
  addImportantPdf,
  deleteImportantPdf,
  resetToDefaultPdfs,
  storeLocalDocument,
  detectFileType,
  clearCorruptedPdfs,
  readDocumentAsBase64,
  buildPdfJsHtml,
  buildImageHtml,
  testPdfUploadAndStore,
} from "./utils/pdfService";

const JNTUA_ICON = require("./assets/images/icon.png");

/* ------------------------------------------------------------------ */
/*  Minimal Luxury Light Gray ("Vogue" Editorial) Design System        */
/* ------------------------------------------------------------------ */
const COLORS = {
  canvas: "#F8F9FA",
  canvasEnd: "#EDEFF2",
  surfaceCard: "#FFFFFF",
  surfaceCardHover: "#F1F3F6",
  surfaceDark: "#0F172A",
  surfacePill: "rgba(15, 23, 42, 0.05)",
  primary: "#0F172A", // Vogue high-fashion charcoal ink
  primaryGlow: "rgba(15, 23, 42, 0.08)",
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  hairline: "rgba(15, 23, 42, 0.08)",
  hairlineSoft: "rgba(15, 23, 42, 0.04)",
  onDark: "#FFFFFF",
  onDarkSoft: "#F1F5F9",
  success: "#059669",
  successSoft: "rgba(5, 150, 105, 0.10)",
  live: "#059669",
  error: "#E11D48",
  errorSoft: "rgba(225, 29, 72, 0.10)",
  amber: "#D97706",
  amberSoft: "rgba(217, 119, 6, 0.10)",
  overlay: "rgba(15, 23, 42, 0.45)",
};

const FONT_VOGUE = Platform.select({ ios: "Didot", android: "serif", default: "serif" });
const FONT_REGULAR = "Outfit_400Regular";
const FONT_MEDIUM = "Outfit_500Medium";
const FONT_SEMIBOLD = "Outfit_600SemiBold";
const FONT_BOLD = "Outfit_700Bold";
const STALL_TIMEOUT_MS = 25000;

const ADMIN_PASSKEY = "630536";

const STATUS_COLOR: Record<AttendanceRecord["status"], string> = {
  Present: COLORS.success,
  Absent: COLORS.error,
  Unknown: COLORS.muted,
};

/* ------------------------------------------------------------------ */
/*  Animation Components                                               */
/* ------------------------------------------------------------------ */
const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

function BouncyButton({ onPress, style, children, activeOpacity = 0.88, ...props }: TouchableOpacityProps & { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = (e: GestureResponderEvent) => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
    if (props.onPressIn) props.onPressIn(e);
  };
  const onPressOut = (e: GestureResponderEvent) => {
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

function PulsingText({ style, children }: { style?: StyleProp<TextStyle>; children: React.ReactNode }) {
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

function FadeInView({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();
  }, [opacity, translateY]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/* ------------------------------------------------------------------ */
/*  State & Reducer                                                   */
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
  const translateY = useRef(new Animated.Value(18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: Math.min(index * 40, 300),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: Math.min(index * 40, 300),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  const pVal = parseFloat(item.percentage);
  const isLow = pVal < 75;
  const canSkip = calculateCanSkip(item.present, item.total);
  const classesToReach75 = calculateClassesToReach75(item.present, item.total);
  const color = getAttendanceColor(pVal);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <BouncyButton
        style={styles.subjectCard}
        activeOpacity={0.85}
        onPress={() => dispatch({ type: "SET_SELECTED_SUBJECT", data: item })}
      >
        <View style={styles.subjectRow1}>
          <Text style={styles.subjectName} numberOfLines={2}>{item.subjectName}</Text>
          <View style={styles.subjectPctWrap}>
            <Text style={[styles.subjectPct, { color }]}>{item.percentage}%</Text>
          </View>
        </View>

        {/* Dynamic Progress Track with 75% Target Marker */}
        <View style={styles.cardTrackWrap}>
          <View style={styles.cardTrackBg}>
            <View
              style={[
                styles.cardTrackFill,
                { width: `${Math.min(100, Math.max(0, pVal))}%`, backgroundColor: color },
              ]}
            />
            <View style={styles.cardTargetNotch} />
          </View>
        </View>

        <View style={styles.subjectRow2}>
          <Text style={styles.shortStats}>
            Attended <Text style={styles.shortStatsBold}>{item.present}</Text>/{item.total}
            {" · "}Missed <Text style={styles.shortStatsBold}>{item.absent}</Text>
          </Text>

          <View
            style={[
              styles.statusChip,
              isLow ? styles.statusChipDanger : canSkip > 0 ? styles.statusChipSuccess : styles.statusChipNeutral,
            ]}
          >
            <Ionicons
              name={isLow ? "arrow-up-circle-outline" : canSkip > 0 ? "checkmark-circle-outline" : "remove-circle-outline"}
              size={13}
              color={isLow ? COLORS.error : canSkip > 0 ? COLORS.success : COLORS.muted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusChipText,
                isLow ? styles.statusChipDangerText : canSkip > 0 ? styles.statusChipSuccessText : styles.statusChipNeutralText,
              ]}
            >
              {isLow
                ? `Need +${classesToReach75}`
                : canSkip > 0
                  ? `Skip ${canSkip} ${canSkip === 1 ? "class" : "classes"}`
                  : "On margin (75%)"}
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
  useMobileAdsInit();
  const [adFailed, setAdFailed] = useState(false);
  const update = useUpdateManager();
  const { checkForUpdate } = update;
  const { AdsterrRectModal } = useAppOpenAd(state.isSplashDismissed);
  const { tryShowInterstitial, InterstitialModal } = useInterstitialAd();

  /* ------------------------------------------------------------------ */
  /*  Navigation & Important PDFs State                                 */
  /* ------------------------------------------------------------------ */
  const [activeTab, setActiveTab] = useState<"attendance" | "pdfs">("attendance");
  const [pdfList, setPdfList] = useState<ImportantPdfItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [pdfSearch, setPdfSearch] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showAddPdfModal, setShowAddPdfModal] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<ImportantPdfItem | null>(null);
  const [viewingHtml, setViewingHtml] = useState<string | null>(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const pdfWebViewRef = useRef<WebViewType | null>(null);

  // New PDF Form fields
  const [newPdfYear, setNewPdfYear] = useState<1 | 2 | 3 | 4>(1);
  const [newPdfSem, setNewPdfSem] = useState("1-1");
  const [newPdfSubject, setNewPdfSubject] = useState("");
  const [newPdfTitle, setNewPdfTitle] = useState("");
  const [newPdfRegulation, setNewPdfRegulation] = useState("R23/R20");
  const [newPdfUrl, setNewPdfUrl] = useState("");
  const [newPdfSize, setNewPdfSize] = useState("");
  // "file" = pick from device storage | "url" = paste a link
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [pickedFileUri, setPickedFileUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load Important PDFs on mount
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const items = await loadImportantPdfs();
      if (mounted) setPdfList(items);
    })();
    return () => { mounted = false; };
  }, []);

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
  const navModalRef = useRef({ showAddPdfModal, showPinModal, activeTab, viewingPdf });
  useEffect(() => { navModalRef.current = { showAddPdfModal, showPinModal, activeTab, viewingPdf }; });

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
      if (__DEV__) console.warn("WebView Message Error:", err);
    }
  }, []);

  /* Back handler */
  useEffect(() => {
    let lastBackPress = 0;
    let subscription: { remove: () => void } | null = null;
    let popstateHandler: (() => void) | null = null;

    const handleBackConsumed = (): boolean => {
      const nav = navModalRef.current;
      if (nav.viewingPdf) {
        setViewingPdf(null);
        return true;
      }
      if (nav.showAddPdfModal) {
        setShowAddPdfModal(false);
        return true;
      }
      if (nav.showPinModal) {
        setShowPinModal(false);
        return true;
      }
      if (nav.activeTab === "pdfs") {
        setActiveTab("attendance");
        return true;
      }

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

  /* ------------------------------------------------------------------ */
  /*  PDF Actions                                                       */
  /* ------------------------------------------------------------------ */
  const handleOpenPdf = useCallback(async (item: ImportantPdfItem) => {
    setViewingPdf(item);
    setViewerError(null);
    setIsViewerLoading(true);

    try {
      const isLocal =
        item.isLocal ||
        item.fileUrl.startsWith("file://") ||
        item.fileUrl.startsWith("content://");
      const fileType = item.fileType || detectFileType(item.fileName || item.fileUrl);

      if (fileType === "image") {
        if (isLocal) {
          const b64 = await readDocumentAsBase64(item.fileUrl);
          setViewingHtml(buildImageHtml(b64, true));
        } else {
          setViewingHtml(buildImageHtml(item.fileUrl, false));
        }
      } else if (fileType === "pdf" || fileType === "other") {
        if (isLocal) {
          // Read local PDF to Base64 and render with embedded PDF.js canvas
          const b64 = await readDocumentAsBase64(item.fileUrl);
          setViewingHtml(buildPdfJsHtml(b64, item.title));
        } else {
          setViewingHtml(null); // Load remote URL via WebView
        }
      } else {
        if (isLocal) {
          try {
            const b64 = await readDocumentAsBase64(item.fileUrl);
            setViewingHtml(buildPdfJsHtml(b64, item.title));
          } catch {
            setViewingHtml(null);
          }
        } else {
          setViewingHtml(null);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not prepare document";
      setViewerError(msg);
    } finally {
      setIsViewerLoading(false);
    }
  }, []);

  const handleOpenExternal = useCallback(async () => {
    if (!viewingPdf) return;
    try {
      if (viewingPdf.fileUrl.startsWith("http")) {
        await Linking.openURL(viewingPdf.fileUrl);
      } else {
        const contentUri = await FileSystem.getContentUriAsync(viewingPdf.fileUrl);
        await Linking.openURL(contentUri);
      }
    } catch {
      Alert.alert(
        "Open Document",
        "Could not launch an external viewer app for this file on your device."
      );
    }
  }, [viewingPdf]);

  const handleVerifyPin = useCallback(() => {
    if (pinInput.trim() === ADMIN_PASSKEY) {
      setIsAdminMode(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError(false);
      Alert.alert("Admin Unlocked", "You can now add or remove Important PDFs for all years.");
    } else {
      setPinError(true);
    }
  }, [pinInput]);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Allow PDFs, Word docs, PowerPoints, images, and text files
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "text/plain",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      setPickedFileUri(asset.uri);
      setNewPdfUrl(asset.uri);
      setPickedFileName(asset.name);
      // Auto-fill title from filename (strip extension)
      if (!newPdfTitle.trim()) {
        setNewPdfTitle(asset.name.replace(/\.[^.]+$/, ""));
      }
      // Auto-fill size
      if (asset.size != null) {
        const mb = (asset.size / (1024 * 1024)).toFixed(1);
        setNewPdfSize(`${mb} MB`);
      }
    } catch {
      Alert.alert("Error", "Could not open file picker. Please try again.");
    }
  }, [newPdfTitle]);

  const handleCreatePdf = useCallback(async () => {
    if (!newPdfSubject.trim() || !newPdfTitle.trim()) {
      Alert.alert("Incomplete Details", "Please provide at least the Subject Name and Document Title.");
      return;
    }
    if (uploadMode === "file" && !pickedFileUri) {
      Alert.alert("No File Picked", "Please select a document from your device first.");
      return;
    }
    if (uploadMode === "url" && !newPdfUrl.trim()) {
      Alert.alert("No Link Entered", "Please paste a document URL.");
      return;
    }

    setIsUploading(true);
    try {
      let finalFileUrl = newPdfUrl.trim();
      let finalFileSize = newPdfSize.trim() || "—";
      let finalFileType: DocumentFileType = "pdf";
      let finalFileName = pickedFileName ?? "Document";
      let isLocal = false;

      if (uploadMode === "file" && pickedFileUri) {
        // Persist file permanently into local database folder
        const stored = await storeLocalDocument(pickedFileUri, pickedFileName || "document.pdf");
        finalFileUrl = stored.persistentUri;
        finalFileSize = stored.fileSize;
        finalFileType = stored.fileType;
        finalFileName = stored.fileName;
        isLocal = true;
      } else {
        finalFileType = detectFileType(finalFileUrl);
      }

      const updated = await addImportantPdf({
        year: newPdfYear,
        semester: newPdfSem.trim() || "1-1",
        subject: newPdfSubject.trim(),
        title: newPdfTitle.trim(),
        regulation: newPdfRegulation.trim() || undefined,
        fileUrl: finalFileUrl,
        fileSize: finalFileSize,
        fileType: finalFileType,
        fileName: finalFileName,
        isLocal,
      });

      setPdfList(updated);
      setShowAddPdfModal(false);
      setNewPdfSubject("");
      setNewPdfTitle("");
      setNewPdfUrl("");
      setNewPdfSize("");
      setPickedFileName(null);
      setPickedFileUri(null);
      setUploadMode("file");
      Alert.alert("Stored Successfully", "Document is permanently saved to your database archive.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to store document";
      Alert.alert("Storage Error", `Could not save document to database: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  }, [
    newPdfSubject,
    newPdfTitle,
    uploadMode,
    pickedFileUri,
    newPdfUrl,
    newPdfSize,
    pickedFileName,
    newPdfYear,
    newPdfSem,
    newPdfRegulation,
  ]);

  const handleDeletePdf = useCallback(async (id: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Remove this PDF document from the university archive?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = await deleteImportantPdf(id);
            setPdfList(updated);
          },
        },
      ]
    );
  }, []);

  const handleResetDefaults = useCallback(async () => {
    Alert.alert(
      "Reset Defaults",
      "Restore default curated academic materials?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            const updated = await resetToDefaultPdfs();
            setPdfList(updated);
          },
        },
      ]
    );
  }, []);

  const handleRunStorageTest = useCallback(async () => {
    Alert.alert("Testing Document Database", "Running end-to-end PDF upload & storage test…");
    const result = await testPdfUploadAndStore();
    if (result.success) {
      const items = await loadImportantPdfs();
      setPdfList(items);
      Alert.alert("Test Passed! ✅", result.message);
    } else {
      Alert.alert("Test Failed ❌", result.message);
    }
  }, []);

  const handleClearCorrupted = useCallback(async () => {
    Alert.alert(
      "Clean Archive",
      "Remove any documents whose local files are missing or corrupted?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clean Up",
          onPress: async () => {
            const updated = await clearCorruptedPdfs();
            setPdfList(updated);
            Alert.alert("Cleaned", "Removed broken entries from document database.");
          },
        },
      ]
    );
  }, []);

  const filteredPdfs = pdfList.filter((item) => {
    const matchesYear = selectedYear === 0 || item.year === selectedYear;
    const query = pdfSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.semester.toLowerCase().includes(query);
    return matchesYear && matchesSearch;
  });

  return (
    <LinearGradient colors={[COLORS.canvas, COLORS.canvasEnd]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {(update.status === "checking" || update.status === "applying") && (
        <View style={styles.updateBanner}>
          <Text style={styles.updateBannerText}>
            {update.status === "applying" ? "Applying update…" : "Checking for updates…"}
          </Text>
        </View>
      )}

      {/* ============================================================== */}
      {/* TAB 1: ATTENDANCE & SCRAPING ENGINE                            */}
      {/* ============================================================== */}
      <View style={activeTab === "attendance" ? styles.tabContentActive : styles.tabContentHidden}>
        {/* WebView stays full-size until scraping is done */}
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
            onError={(event) => {
              if (__DEV__) console.warn("WebView error:", event.nativeEvent.description);
            }}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode === 502) dispatch({ type: "SET_GATEWAY_ERROR" });
            }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled={false}
            geolocationEnabled={false}
            allowsFullscreenVideo={false}
            mediaPlaybackRequiresUserAction
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(request) => {
              // Only allow navigation within the JNTUA portal domain.
              // Block all other external navigations to prevent clickjacking
              // or redirect attacks.
              const allowed = request.url.startsWith(
                "https://jntuaceastudents.classattendance.in"
              );
              return allowed;
            }}
          />
          {!isLoggedIn && hasPreviousResult && (
            <BouncyButton style={styles.prevBtn} onPress={handlePreviousAttendance} activeOpacity={0.88}>
              <Ionicons name="time-outline" size={18} color={COLORS.ink} style={{ marginRight: 8 }} />
              <Text style={styles.prevBtnText}>View Cached Attendance</Text>
            </BouncyButton>
          )}
        </View>

        {/* 502 GATEWAY ERROR OVERLAY */}
        {gatewayError && (
          <View style={styles.overlayFull}>
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={40} color={COLORS.error} style={{ marginBottom: 12 }} />
              <Text style={styles.syncTitle}>{"Main Portal\nis Unavailable"}</Text>
              <Text style={styles.syncSub}>The attendance server returned a 502 Bad Gateway response. Please try again later.</Text>
              <TouchableOpacity style={styles.errorBtn} onPress={handleFullReset}>
                <Text style={styles.errorBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SYNC LOADER OVERLAY */}
        {isLoggedIn && !isScrapingFinished && !isSelectionError && (
          <View style={styles.overlayFull}>
            <View style={styles.syncRingOuter}>
              <View style={styles.syncRingInner}>
                <Ionicons name="sparkles" size={28} color={COLORS.primary} />
              </View>
            </View>
            <PulsingText style={styles.syncTitle}>Syncing Attendance</PulsingText>
            <Text style={styles.syncSub}>Analyzing classes & records from portal…</Text>
            <View style={styles.syncStatusBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.success} style={{ marginRight: 6 }} />
              <Text style={styles.syncStatusText}>Encrypted device-only session</Text>
            </View>
          </View>
        )}

        {/* SELECTION ERROR OVERLAY */}
        {isSelectionError && isLoggedIn && !isScrapingFinished && (
          <View style={styles.overlayFull}>
            <View style={styles.errorCard}>
              <TouchableOpacity style={styles.closeIcon} onPress={() => dispatch({ type: "CLEAR_SELECTION_ERROR" })}>
                <Ionicons name="close" size={18} color={COLORS.body} />
              </TouchableOpacity>
              <Ionicons name="alert-circle-outline" size={38} color={COLORS.error} style={{ marginBottom: 10 }} />
              <Text style={styles.errorTitle}>Portal Synchronization Paused</Text>
              <Text style={styles.errorBody}>
                The student portal format was recently updated, delaying automated detection.
                Please reload to retry session extraction.
              </Text>
              <BouncyButton style={styles.errorBtn} onPress={handleFullReset}>
                <Text style={styles.errorBtnText}>Retry Extraction</Text>
              </BouncyButton>
            </View>
          </View>
        )}

        {/* DASHBOARD: Scraped records and aggregate cards */}
        {isLoggedIn && isScrapingFinished && (
          <FadeInView style={styles.dashboardContainer}>
            <View style={styles.sigRow}>
              <View style={styles.wordmark}>
                <View style={styles.wordmarkLogo}>
                  <Ionicons name="school" size={15} color={COLORS.onDark} />
                </View>
                <Text style={styles.wordmarkText}>JNTUA</Text>
                <View style={styles.wordmarkBadge}>
                  <Text style={styles.wordmarkRole}>ATTENDANCE</Text>
                </View>
              </View>
              <BouncyButton style={styles.iconBtn} onPress={handleFullReset} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={18} color={COLORS.body} />
              </BouncyButton>
            </View>

            <FlatList
              style={{ flex: 1 }}
              data={subjectsData}
              keyExtractor={(item, index) => `${item.subjectName}-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListHeaderComponent={
                <View>
                  {studentInfo && (
                    <View style={styles.profileCard}>
                      <View style={styles.avatarCircle}>
                        <Image
                          source={JNTUA_ICON}
                          style={styles.avatarImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={styles.profileName} numberOfLines={1}>{studentInfo.name}</Text>
                        <Text style={styles.profileMeta} numberOfLines={1}>
                          {studentInfo.admissionNo} • {studentInfo.className}
                        </Text>
                      </View>
                      <View style={styles.liveStatusPill}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveStatusText}>Verified</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.overallCard}>
                    <View style={styles.overallTopRow}>
                      <View style={styles.eyebrowRow}>
                        <View style={[styles.eyebrowDot, { backgroundColor: getAttendanceColor(overallPercentageVal) }]} />
                        <Text style={styles.eyebrowSm}>SEMESTER ATTENDANCE</Text>
                      </View>
                      <View style={[styles.badgePill, isShortage ? styles.badgeShortage : styles.badgeNormal]}>
                        <Text style={[styles.badgePillText, isShortage ? styles.badgeShortageText : styles.badgeNormalText]}>
                          {isShortage ? "Shortage Risk" : "Good Standing"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bigPctRow}>
                      <Text style={[styles.bigPct, { color: getAttendanceColor(overallPercentageVal) }]}>
                        {overallPercentage}
                        <Text style={styles.bigPctSign}>%</Text>
                      </Text>
                      <View style={styles.targetBadge}>
                        <Text style={styles.targetBadgeLabel}>Goal: 75%</Text>
                      </View>
                    </View>

                    {/* Overall Progress Bar with 75% Threshold Notch */}
                    <View style={styles.overallTrackContainer}>
                      <View style={styles.overallTrackBg}>
                        <View
                          style={[
                            styles.overallTrackFill,
                            {
                              width: `${Math.min(100, Math.max(0, overallPercentageVal))}%`,
                              backgroundColor: getAttendanceColor(overallPercentageVal),
                            },
                          ]}
                        />
                        <View style={styles.overallNotch} />
                      </View>
                      <View style={styles.overallNotchLabels}>
                        <Text style={styles.trackMinLabel}>0%</Text>
                        <Text style={styles.trackGoalLabel}>75% threshold</Text>
                        <Text style={styles.trackMaxLabel}>100%</Text>
                      </View>
                    </View>

                    <View style={styles.miniStats}>
                      <View style={styles.miniStat}>
                        <Text style={styles.miniStatNum}>{overallClasses}</Text>
                        <Text style={styles.miniStatLabel}>TOTAL HELD</Text>
                      </View>
                      <View style={styles.miniDivider} />
                      <View style={styles.miniStat}>
                        <Text style={[styles.miniStatNum, { color: COLORS.success }]}>{overallPresent}</Text>
                        <Text style={styles.miniStatLabel}>ATTENDED</Text>
                      </View>
                      <View style={styles.miniDivider} />
                      <View style={styles.miniStat}>
                        <Text style={[styles.miniStatNum, { color: overallAbsent > 0 ? COLORS.error : COLORS.muted }]}>{overallAbsent}</Text>
                        <Text style={styles.miniStatLabel}>MISSED</Text>
                      </View>
                    </View>

                    <View style={[styles.skipRow, isShortage ? styles.skipRowAlert : styles.skipRowSafe]}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.skipTitle}>
                          {isShortage ? "Attendance Shortage" : "Safe to Skip"}
                        </Text>
                        <Text style={styles.skipSub}>
                          {isShortage
                            ? "Classes needed to reach the 75% threshold"
                            : "Classes you can miss while staying >= 75%"}
                        </Text>
                      </View>
                      <View style={[styles.skipBadge, isShortage ? styles.skipBadgeAlert : styles.skipBadgeSafe]}>
                        <Text style={[styles.skipBadgeText, isShortage ? styles.skipBadgeAlertText : styles.skipBadgeSafeText]}>
                          {isShortage
                            ? `+${calculateClassesToReach75(overallPresent, overallClasses)} classes`
                            : `${maxOverallSkippable} ${maxOverallSkippable === 1 ? "class" : "classes"}`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.listHead}>
                    <Text style={styles.eyebrowSm}>COURSES & LABS</Text>
                    <View style={styles.subjectCountBadge}>
                      <Text style={styles.listCount}>{subjectsData.length} Subjects</Text>
                    </View>
                  </View>
                </View>
              }
              ListFooterComponent={
                <View style={styles.footBand}>
                  <View style={styles.footIconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.footTitle}>JNTUA Attendance</Text>
                  <Text style={styles.footSub}>Calculations are based on the official 75% university threshold.</Text>
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
          </FadeInView>
        )}
      </View>

      {/* ============================================================== */}
      {/* TAB 2: IMPORTANT PDFS & CURATED ACADEMIC ARCHIVE               */}
      {/* ============================================================== */}
      <View style={activeTab === "pdfs" ? styles.tabContentActive : styles.tabContentHidden}>
        <FadeInView style={styles.pdfArchiveContainer}>
          {/* Header */}
          <View style={styles.pdfHeaderRow}>
            <View>
              <Text style={styles.eyebrowSm}>ACADEMIC ARCHIVE</Text>
              <Text style={styles.vogueHeading}>Important PDFs</Text>
            </View>

            <View style={styles.pdfHeaderActions}>
              {isAdminMode ? (
                <>
                  <BouncyButton
                    style={styles.adminActiveBadge}
                    onPress={() => setIsAdminMode(false)}
                  >
                    <Ionicons name="shield-checkmark" size={13} color={COLORS.success} style={{ marginRight: 4 }} />
                    <Text style={styles.adminActiveText}>Admin</Text>
                  </BouncyButton>
                  <BouncyButton
                    style={styles.addPdfBtn}
                    onPress={() => setShowAddPdfModal(true)}
                  >
                    <Ionicons name="add" size={16} color={COLORS.onDark} />
                    <Text style={styles.addPdfBtnText}>Add PDF</Text>
                  </BouncyButton>
                </>
              ) : (
                <BouncyButton
                  style={styles.adminLockBtn}
                  onPress={() => setShowPinModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="key-outline" size={17} color={COLORS.body} />
                </BouncyButton>
              )}
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={COLORS.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by subject, code, or topic…"
              placeholderTextColor={COLORS.mutedSoft}
              value={pdfSearch}
              onChangeText={setPdfSearch}
            />
            {!!pdfSearch && (
              <TouchableOpacity onPress={() => setPdfSearch("")}>
                <Ionicons name="close-circle" size={16} color={COLORS.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Year Filter Pills */}
          <View style={styles.filterPillsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
              {([0, 1, 2, 3, 4] as const).map((yr) => {
                const label = yr === 0 ? "All Years" : `${yr}${yr === 1 ? "st" : yr === 2 ? "nd" : yr === 3 ? "rd" : "th"} Year`;
                const isSelected = selectedYear === yr;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                    onPress={() => setSelectedYear(yr)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* PDF Documents List */}
          <FlatList
            data={filteredPdfs}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <View style={styles.emptyPdfState}>
                <Ionicons name="document-text-outline" size={38} color={COLORS.mutedSoft} style={{ marginBottom: 10 }} />
                <Text style={styles.emptyPdfTitle}>No PDFs Found</Text>
                <Text style={styles.emptyPdfSub}>
                  {pdfSearch ? "Try adjusting your search query." : "No documents uploaded for this year category yet."}
                </Text>
                {isAdminMode && (
                  <BouncyButton style={[styles.addPdfBtn, { marginTop: 14 }]} onPress={() => setShowAddPdfModal(true)}>
                    <Text style={styles.addPdfBtnText}>+ Upload First Document</Text>
                  </BouncyButton>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.pdfCard}>
                <View style={styles.pdfCardMetaRow}>
                  <View style={styles.yearTag}>
                    <Text style={styles.yearTagText}>Year {item.year} · Sem {item.semester}</Text>
                  </View>
                  {!!item.regulation && (
                    <View style={styles.regTag}>
                      <Text style={styles.regTagText}>{item.regulation}</Text>
                    </View>
                  )}
                  {item.isLocal && (
                    <View style={styles.localTag}>
                      <Ionicons name="shield-checkmark" size={10} color="#059669" style={{ marginRight: 3 }} />
                      <Text style={styles.localTagText}>STORED</Text>
                    </View>
                  )}
                  <Text style={styles.pdfSubjectText} numberOfLines={1}>{item.subject}</Text>
                </View>

                <Text style={styles.pdfCardTitle} numberOfLines={2}>{item.title}</Text>

                <View style={styles.pdfCardFooter}>
                  <Text style={styles.pdfMetaInfo}>{item.fileSize} • Added {item.uploadedAt}</Text>
                  
                  <View style={styles.pdfCardActions}>
                    <BouncyButton
                      style={styles.openPdfBtn}
                      onPress={() => handleOpenPdf(item)}
                    >
                      <Ionicons name="eye-outline" size={13} color={COLORS.onDark} style={{ marginRight: 5 }} />
                      <Text style={styles.openPdfBtnText}>View</Text>
                    </BouncyButton>

                    {isAdminMode && (
                      <TouchableOpacity
                        style={styles.deletePdfBtn}
                        onPress={() => handleDeletePdf(item.id)}
                      >
                        <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        </FadeInView>
      </View>

      {/* ============================================================== */}
      {/* NON-INTRUSIVE AD BANNER (OPTIMAL POSITION ABOVE NAV BAR)       */}
      {/* ============================================================== */}
      {!adFailed && (
        <View style={styles.adBanner}>
          <BannerAdWrapper onAdFailedToLoad={() => setAdFailed(true)} />
        </View>
      )}

      {/* ============================================================== */}
      {/* MINIMAL LUXURY BOTTOM NAVIGATION BAR                           */}
      {/* ============================================================== */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navTab, activeTab === "attendance" && styles.navTabActive]}
          onPress={() => setActiveTab("attendance")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "attendance" ? "school" : "school-outline"}
            size={20}
            color={activeTab === "attendance" ? COLORS.ink : COLORS.muted}
          />
          <Text style={[styles.navLabel, activeTab === "attendance" && styles.navLabelActive]}>
            ATTENDANCE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === "pdfs" && styles.navTabActive]}
          onPress={() => setActiveTab("pdfs")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "pdfs" ? "document-text" : "document-text-outline"}
            size={20}
            color={activeTab === "pdfs" ? COLORS.ink : COLORS.muted}
          />
          <Text style={[styles.navLabel, activeTab === "pdfs" && styles.navLabelActive]}>
            IMPORTANT PDFS
          </Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================== */}
      {/* MODAL: DATE LOG SHEET                                          */}
      {/* ============================================================== */}
      <Modal
        visible={!!selectedSubject}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <View style={styles.modalSheet}>
            {selectedSubject && (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.modalTitle} numberOfLines={2}>{selectedSubject.subjectName}</Text>
                    <Text style={styles.modalSub}>
                      {selectedSubject.present} attended · {selectedSubject.absent} missed · {selectedSubject.percentage}%
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeIcon} onPress={handleCloseModal}>
                    <Ionicons name="close" size={18} color={COLORS.body} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={selectedSubject.records}
                  keyExtractor={(_, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 8 }}
                  ListEmptyComponent={
                    <View style={styles.emptyLogWrap}>
                      <Ionicons name="calendar-outline" size={28} color={COLORS.mutedSoft} style={{ marginBottom: 8 }} />
                      <Text style={styles.emptyLogText}>No individual class dates logged for this subject yet.</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isPresent = item.status === "Present";
                    return (
                      <View style={styles.logRow}>
                        <View style={styles.logLeft}>
                          <View style={[styles.logIndicatorDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                          <View>
                            <Text style={styles.logDate}>{item.date}</Text>
                            {!!item.time && <Text style={styles.logTime}>{item.time}</Text>}
                          </View>
                        </View>
                        <View style={[styles.logBadge, isPresent ? styles.logBadgePresent : styles.logBadgeAbsent]}>
                          <Ionicons
                            name={isPresent ? "checkmark" : "close"}
                            size={12}
                            color={STATUS_COLOR[item.status]}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[styles.logBadgeText, { color: STATUS_COLOR[item.status] }]}
                          >
                            {item.status}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: ADMIN PIN UNLOCK                                        */}
      {/* ============================================================== */}
      <Modal
        visible={showPinModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPinModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowPinModal(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: 32 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Admin Access</Text>
                <Text style={styles.modalSub}>Enter the 6-digit passkey to curate university materials.</Text>
              </View>
              <TouchableOpacity style={styles.closeIcon} onPress={() => setShowPinModal(false)}>
                <Ionicons name="close" size={18} color={COLORS.body} />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 20 }}>
              <TextInput
                style={[styles.pinInput, pinError && styles.pinInputError]}
                placeholder="••••••"
                placeholderTextColor={COLORS.mutedSoft}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={pinInput}
                onChangeText={(t) => {
                  setPinInput(t);
                  setPinError(false);
                }}
              />
              {pinError && (
                <Text style={styles.pinErrorText}>Invalid passcode. Please retry.</Text>
              )}
            </View>

            <BouncyButton style={styles.adminSubmitBtn} onPress={handleVerifyPin}>
              <Text style={styles.adminSubmitBtnText}>Unlock Admin Mode</Text>
            </BouncyButton>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: ADD IMPORTANT PDF (ADMIN)                               */}
      {/* ============================================================== */}
      <Modal
        visible={showAddPdfModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPdfModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowAddPdfModal(false)}
          />
          <View style={[styles.modalSheet, { maxHeight: "92%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Upload Document</Text>
                <Text style={styles.modalSub}>Add a resource to the student archive.</Text>
              </View>
              <TouchableOpacity style={styles.closeIcon} onPress={() => setShowAddPdfModal(false)}>
                <Ionicons name="close" size={18} color={COLORS.body} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>

              {/* ── Upload Mode Toggle ── */}
              <View style={styles.uploadModeToggle}>
                <TouchableOpacity
                  style={[styles.uploadModeBtn, uploadMode === "file" && styles.uploadModeBtnActive]}
                  onPress={() => { setUploadMode("file"); setNewPdfUrl(""); setPickedFileName(null); setNewPdfSize(""); }}
                >
                  <Ionicons name="document-attach-outline" size={15} color={uploadMode === "file" ? COLORS.onDark : COLORS.muted} />
                  <Text style={[styles.uploadModeBtnText, uploadMode === "file" && styles.uploadModeBtnTextActive]}>
                    Pick from Device
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadModeBtn, uploadMode === "url" && styles.uploadModeBtnActive]}
                  onPress={() => { setUploadMode("url"); setNewPdfUrl(""); setPickedFileName(null); setNewPdfSize(""); }}
                >
                  <Ionicons name="link-outline" size={15} color={uploadMode === "url" ? COLORS.onDark : COLORS.muted} />
                  <Text style={[styles.uploadModeBtnText, uploadMode === "url" && styles.uploadModeBtnTextActive]}>
                    Paste Link
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── File Picker Mode ── */}
              {uploadMode === "file" && (
                <TouchableOpacity style={styles.fileDrop} onPress={handlePickFile} activeOpacity={0.75}>
                  {pickedFileName ? (
                    <>
                      <Ionicons name="document-text" size={28} color={COLORS.primary} />
                      <Text style={styles.fileDropName} numberOfLines={2}>{pickedFileName}</Text>
                      {newPdfSize ? <Text style={styles.fileDropMeta}>{newPdfSize} · Tap to change</Text> : null}
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={32} color={COLORS.muted} />
                      <Text style={styles.fileDropLabel}>Tap to pick a file</Text>
                      <Text style={styles.fileDropHint}>PDF · DOCX · PPTX · Images · TXT</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* ── URL Paste Mode ── */}
              {uploadMode === "url" && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.formLabel}>Document Link / URL</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="https://drive.google.com/... or any public URL"
                    placeholderTextColor={COLORS.mutedSoft}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={newPdfUrl}
                    onChangeText={setNewPdfUrl}
                  />
                  <Text style={styles.formLabel}>Estimated File Size</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 2.4 MB (optional)"
                    placeholderTextColor={COLORS.mutedSoft}
                    value={newPdfSize}
                    onChangeText={setNewPdfSize}
                  />
                </View>
              )}

              {/* ── Divider ── */}
              <View style={styles.uploadDivider}>
                <View style={styles.uploadDividerLine} />
                <Text style={styles.uploadDividerText}>DOCUMENT INFO</Text>
                <View style={styles.uploadDividerLine} />
              </View>

              {/* Year Select */}
              <Text style={styles.formLabel}>Target Year</Text>
              <View style={styles.formYearRow}>
                {([1, 2, 3, 4] as const).map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.formYearBtn, newPdfYear === yr && styles.formYearBtnActive]}
                    onPress={() => setNewPdfYear(yr)}
                  >
                    <Text style={[styles.formYearBtnText, newPdfYear === yr && styles.formYearBtnTextActive]}>
                      Year {yr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Semester & Regulation */}
              <View style={styles.formRow2}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.formLabel}>Semester</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 1-1, 2-2"
                    placeholderTextColor={COLORS.mutedSoft}
                    value={newPdfSem}
                    onChangeText={setNewPdfSem}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.formLabel}>Regulation</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. R23/R20"
                    placeholderTextColor={COLORS.mutedSoft}
                    value={newPdfRegulation}
                    onChangeText={setNewPdfRegulation}
                  />
                </View>
              </View>

              {/* Subject */}
              <Text style={styles.formLabel}>Subject Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Data Structures, Applied Physics"
                placeholderTextColor={COLORS.mutedSoft}
                value={newPdfSubject}
                onChangeText={setNewPdfSubject}
              />

              {/* Document Title */}
              <Text style={styles.formLabel}>Document Title</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Formula Handbook & Solved Papers"
                placeholderTextColor={COLORS.mutedSoft}
                value={newPdfTitle}
                onChangeText={setNewPdfTitle}
              />

              <BouncyButton
                style={[styles.adminSubmitBtn, { marginTop: 20 }]}
                onPress={handleCreatePdf}
                disabled={isUploading}
              >
                {isUploading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color={COLORS.onDark} />
                    <Text style={styles.adminSubmitBtnText}>Storing into Database…</Text>
                  </View>
                ) : (
                  <Text style={styles.adminSubmitBtnText}>Publish to Archive</Text>
                )}
              </BouncyButton>

              {/* Maintenance & Test Tools */}
              <View style={styles.archiveAdminTools}>
                <TouchableOpacity style={styles.adminToolBtn} onPress={handleRunStorageTest}>
                  <Ionicons name="flash-outline" size={14} color={COLORS.ink} />
                  <Text style={styles.adminToolBtnText}>Test PDF Upload & Store</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.adminToolBtn} onPress={handleClearCorrupted}>
                  <Ionicons name="trash-bin-outline" size={14} color={COLORS.body} />
                  <Text style={styles.adminToolBtnText}>Clean Broken Entries</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.resetPdfsLink} onPress={handleResetDefaults}>
                <Text style={styles.resetPdfsLinkText}>Reset Archive to University Defaults</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: IN-APP DOCUMENT VIEWER (PDF.JS & OFFLINE DB VIEWER)     */}
      {/* ============================================================== */}
      <Modal
        visible={!!viewingPdf}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setViewingPdf(null);
          setViewingHtml(null);
          setViewerError(null);
        }}
      >
        <View style={styles.pdfViewerContainer}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.surfaceCard} />

          {/* Viewer Top Bar */}
          <View style={styles.pdfViewerHeader}>
            <TouchableOpacity
              style={styles.pdfViewerBackBtn}
              onPress={() => {
                setViewingPdf(null);
                setViewingHtml(null);
                setViewerError(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.ink} />
            </TouchableOpacity>

            <View style={styles.pdfViewerTitleWrap}>
              <Text style={styles.pdfViewerTitle} numberOfLines={1}>
                {viewingPdf?.title ?? "Document Viewer"}
              </Text>
              <Text style={styles.pdfViewerSubtitle} numberOfLines={1}>
                {viewingPdf?.subject} {viewingPdf?.regulation ? `• ${viewingPdf.regulation}` : ""} {viewingPdf?.isLocal ? "• Local Storage" : ""}
              </Text>
            </View>

            <View style={styles.pdfViewerActions}>
              <TouchableOpacity
                style={styles.pdfViewerActionBtn}
                onPress={handleOpenExternal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Open in External App"
              >
                <Ionicons name="open-outline" size={18} color={COLORS.ink} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pdfViewerActionBtn}
                onPress={() => {
                  if (viewingPdf) void handleOpenPdf(viewingPdf);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Reload Document"
              >
                <Ionicons name="reload-outline" size={18} color={COLORS.ink} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Embedded Document View */}
          {viewingPdf && (
            <View style={styles.pdfViewerBody}>
              {isViewerLoading && (
                <View style={styles.pdfViewerLoading}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.pdfViewerLoadingText}>Preparing document in-app…</Text>
                </View>
              )}

              {viewerError ? (
                <View style={styles.pdfViewerErrorWrap}>
                  <Ionicons name="alert-circle-outline" size={38} color={COLORS.error} />
                  <Text style={styles.pdfViewerErrorTitle}>Could Not Open Document</Text>
                  <Text style={styles.pdfViewerErrorSub}>{viewerError}</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={styles.pdfViewerRetryBtn}
                      onPress={() => {
                        if (viewingPdf) void handleOpenPdf(viewingPdf);
                      }}
                    >
                      <Text style={styles.pdfViewerRetryBtnText}>Retry</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pdfViewerRetryBtn, { backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.hairline }]}
                      onPress={handleOpenExternal}
                    >
                      <Text style={[styles.pdfViewerRetryBtnText, { color: COLORS.ink }]}>External Viewer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : viewingHtml ? (
                <WebView
                  ref={pdfWebViewRef}
                  style={styles.pdfViewerWebview}
                  source={{ html: viewingHtml }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  allowFileAccess={true}
                  originWhitelist={["*"]}
                  scalesPageToFit={true}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.pdfViewerLoading}>
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={styles.pdfViewerLoadingText}>Rendering document in-app…</Text>
                    </View>
                  )}
                />
              ) : (
                <WebView
                  ref={pdfWebViewRef}
                  style={styles.pdfViewerWebview}
                  source={{
                    uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewingPdf.fileUrl)}`,
                  }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  scalesPageToFit={true}
                  setSupportMultipleWindows={false}
                  onShouldStartLoadWithRequest={(request) => {
                    if (
                      request.url.includes("docs.google.com") ||
                      request.url.includes("google.com/gview") ||
                      request.url === viewingPdf.fileUrl
                    ) {
                      return true;
                    }
                    return false;
                  }}
                  renderLoading={() => (
                    <View style={styles.pdfViewerLoading}>
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={styles.pdfViewerLoadingText}>Loading document in-app…</Text>
                    </View>
                  )}
                  renderError={() => (
                    <View style={styles.pdfViewerErrorWrap}>
                      <Ionicons name="alert-circle-outline" size={38} color={COLORS.error} />
                      <Text style={styles.pdfViewerErrorTitle}>Unable to Display Online Document</Text>
                      <Text style={styles.pdfViewerErrorSub}>
                        Google Docs preview could not load this online link. You can open it directly in your browser or document viewer app.
                      </Text>
                      <TouchableOpacity
                        style={styles.pdfViewerRetryBtn}
                        onPress={handleOpenExternal}
                      >
                        <Text style={styles.pdfViewerRetryBtnText}>Open with External App</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* ADSTERRA ADS: APP-OPEN RECTANGLE & INTERSTITIAL MODALS         */}
      {/* ============================================================== */}
      {AdsterrRectModal}
      {InterstitialModal}

      {/* Adsterra Popunder — fires once on mount, invisible             */}
      <PopunderAdWrapper />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 38) : 38,
  },

  tabContentActive: {
    flex: 1,
  },
  tabContentHidden: {
    display: "none",
  },

  updateBanner: {
    backgroundColor: COLORS.surfaceCard,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  updateBannerText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  hiddenWebView: { width: 0, height: 0, overflow: "hidden" },
  fullWebView: { flex: 1 },

  /* Previous cached attendance pill */
  prevBtn: {
    position: "absolute",
    bottom: 36,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    paddingVertical: 14,
    borderRadius: 9999,
    elevation: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  prevBtnText: {
    fontFamily: FONT_SEMIBOLD,
    color: COLORS.ink,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  /* Overlays */
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  syncRingOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  syncRingInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  syncTitle: {
    fontFamily: FONT_VOGUE,
    fontSize: 26,
    letterSpacing: -0.4,
    color: COLORS.ink,
    textAlign: "center",
  },
  syncSub: {
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: "center",
  },
  syncStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  syncStatusText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: COLORS.muted,
  },

  errorCard: {
    width: "100%",
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  errorTitle: {
    fontFamily: FONT_VOGUE,
    fontSize: 21,
    letterSpacing: -0.3,
    color: COLORS.ink,
    marginTop: 12,
    textAlign: "center",
  },
  errorBody: {
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    marginTop: 8,
    textAlign: "center",
  },
  errorBtn: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingVertical: 12,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 18,
  },
  errorBtnText: {
    fontFamily: FONT_SEMIBOLD,
    color: COLORS.onDark,
    fontSize: 14,
  },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Dashboard */
  dashboardContainer: { flex: 1, paddingHorizontal: 18 },
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
  },
  wordmark: { flexDirection: "row", alignItems: "center" },
  wordmarkLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  wordmarkText: {
    fontFamily: FONT_VOGUE,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: COLORS.ink,
  },
  wordmarkBadge: {
    backgroundColor: COLORS.surfacePill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  wordmarkRole: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: COLORS.muted,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    overflow: "hidden",
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 16,
    letterSpacing: -0.3,
    color: COLORS.ink,
  },
  profileMeta: {
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  liveStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
    marginRight: 5,
  },
  liveStatusText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 10.5,
    color: COLORS.success,
  },

  overallCard: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  overallTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center" },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  eyebrowSm: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  badgePill: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeNormal: { backgroundColor: COLORS.successSoft },
  badgeNormalText: { fontFamily: FONT_MEDIUM, fontSize: 10.5, color: COLORS.success },
  badgeShortage: { backgroundColor: COLORS.errorSoft },
  badgeShortageText: { fontFamily: FONT_MEDIUM, fontSize: 10.5, color: COLORS.error },
  badgePillText: { fontFamily: FONT_MEDIUM, fontSize: 10.5 },

  bigPctRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 4,
  },
  bigPct: {
    fontFamily: FONT_BOLD,
    fontSize: 54,
    letterSpacing: -2,
    lineHeight: 58,
  },
  bigPctSign: {
    fontFamily: FONT_MEDIUM,
    fontSize: 26,
    color: COLORS.mutedSoft,
  },
  targetBadge: {
    backgroundColor: COLORS.surfacePill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  targetBadgeLabel: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    color: COLORS.muted,
  },

  overallTrackContainer: { marginVertical: 12 },
  overallTrackBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    overflow: "visible",
    position: "relative",
    justifyContent: "center",
  },
  overallTrackFill: {
    height: "100%",
    borderRadius: 4,
  },
  overallNotch: {
    position: "absolute",
    left: "75%",
    top: -3,
    bottom: -3,
    width: 2.5,
    borderRadius: 1,
    backgroundColor: COLORS.ink,
    opacity: 0.75,
  },
  overallNotchLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  trackMinLabel: { fontFamily: FONT_REGULAR, fontSize: 10, color: COLORS.mutedSoft },
  trackGoalLabel: { fontFamily: FONT_MEDIUM, fontSize: 10, color: COLORS.muted },
  trackMaxLabel: { fontFamily: FONT_REGULAR, fontSize: 10, color: COLORS.mutedSoft },

  miniStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
    paddingTop: 14,
    marginTop: 8,
  },
  miniStat: { flex: 1, alignItems: "center" },
  miniStatNum: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 18,
    color: COLORS.ink,
  },
  miniStatLabel: {
    fontFamily: FONT_MEDIUM,
    fontSize: 9,
    letterSpacing: 1.1,
    color: COLORS.mutedSoft,
    marginTop: 3,
  },
  miniDivider: { width: 1, backgroundColor: COLORS.hairlineSoft },

  skipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  skipRowSafe: {
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  skipRowAlert: {
    backgroundColor: COLORS.errorSoft,
    borderWidth: 1,
    borderColor: "rgba(225, 29, 72, 0.2)",
  },
  skipTitle: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 13,
    color: COLORS.ink,
  },
  skipSub: {
    fontFamily: FONT_REGULAR,
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  skipBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  skipBadgeSafe: { backgroundColor: COLORS.success },
  skipBadgeSafeText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11.5,
    color: COLORS.onDark,
  },
  skipBadgeAlert: { backgroundColor: COLORS.error },
  skipBadgeAlertText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11.5,
    color: COLORS.onDark,
  },
  skipBadgeText: { fontFamily: FONT_SEMIBOLD, fontSize: 11.5 },

  listHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  subjectCountBadge: {
    backgroundColor: COLORS.surfacePill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  listCount: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    color: COLORS.muted,
  },

  /* Subject Card */
  subjectCard: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  subjectRow1: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  subjectName: {
    flex: 1,
    fontFamily: FONT_SEMIBOLD,
    fontSize: 14.5,
    color: COLORS.ink,
    lineHeight: 20,
    marginRight: 10,
  },
  subjectPctWrap: { alignItems: "flex-end" },
  subjectPct: {
    fontFamily: FONT_BOLD,
    fontSize: 22,
    letterSpacing: -0.6,
  },

  cardTrackWrap: { marginVertical: 10 },
  cardTrackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    overflow: "visible",
    position: "relative",
    justifyContent: "center",
  },
  cardTrackFill: {
    height: "100%",
    borderRadius: 2,
  },
  cardTargetNotch: {
    position: "absolute",
    left: "75%",
    top: -2,
    bottom: -2,
    width: 2,
    borderRadius: 1,
    backgroundColor: COLORS.ink,
    opacity: 0.6,
  },

  subjectRow2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shortStats: {
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    color: COLORS.muted,
  },
  shortStatsBold: {
    fontFamily: FONT_SEMIBOLD,
    color: COLORS.ink,
  },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusChipSuccess: { backgroundColor: COLORS.successSoft },
  statusChipSuccessText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    color: COLORS.success,
  },
  statusChipDanger: { backgroundColor: COLORS.errorSoft },
  statusChipDangerText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    color: COLORS.error,
  },
  statusChipNeutral: { backgroundColor: COLORS.surfacePill },
  statusChipNeutralText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    color: COLORS.muted,
  },
  statusChipText: { fontFamily: FONT_MEDIUM, fontSize: 11 },

  footBand: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  footIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfacePill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  footTitle: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 16,
    color: COLORS.ink,
  },
  footSub: {
    fontFamily: FONT_REGULAR,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.muted,
    marginTop: 4,
    textAlign: "center",
  },

  /* ------------------------------------------------------------------ */
  /* IMPORTANT PDFS TAB STYLING (Vogue Editorial Aesthetic)             */
  /* ------------------------------------------------------------------ */
  pdfArchiveContainer: {
    flex: 1,
    paddingHorizontal: 18,
  },
  pdfHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 10,
    paddingBottom: 14,
  },
  vogueHeading: {
    fontFamily: FONT_VOGUE,
    fontSize: 27,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.ink,
  },
  pdfHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adminActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  adminActiveText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11,
    color: COLORS.success,
  },
  adminLockBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  addPdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  addPdfBtnText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 12,
    color: COLORS.onDark,
    marginLeft: 2,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    color: COLORS.ink,
    paddingVertical: 4,
  },

  filterPillsRow: {
    marginBottom: 14,
  },
  filterPillsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: COLORS.muted,
  },
  filterPillTextActive: {
    color: COLORS.onDark,
  },

  emptyPdfState: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 36,
    marginTop: 20,
  },
  emptyPdfTitle: {
    fontFamily: FONT_VOGUE,
    fontSize: 20,
    color: COLORS.ink,
  },
  emptyPdfSub: {
    fontFamily: FONT_REGULAR,
    fontSize: 12.5,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
  },

  pdfCard: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  pdfCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  yearTag: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  yearTagText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 10.5,
    color: "#2563EB",
  },
  regTag: {
    backgroundColor: COLORS.surfacePill,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  regTagText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 10.5,
    color: COLORS.muted,
  },
  pdfSubjectText: {
    flex: 1,
    fontFamily: FONT_MEDIUM,
    fontSize: 11.5,
    color: COLORS.body,
    marginLeft: 2,
  },
  pdfCardTitle: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 15,
    color: COLORS.ink,
    lineHeight: 21,
    marginBottom: 10,
  },
  pdfCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
    paddingTop: 10,
  },
  pdfMetaInfo: {
    fontFamily: FONT_REGULAR,
    fontSize: 11.5,
    color: COLORS.muted,
  },
  pdfCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  openPdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  openPdfBtnText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11.5,
    color: COLORS.onDark,
  },
  deletePdfBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.errorSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Non-intrusive Ad Banner Container */
  adBanner: {
    alignItems: "center",
    backgroundColor: "transparent",
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
  },

  /* Bottom Navigation Bar */
  navBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    paddingVertical: 8,
    paddingBottom: Platform.OS === "android" ? 12 : 24,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRadius: 8,
  },
  navTabActive: {},
  navLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.muted,
    marginTop: 4,
  },
  navLabelActive: {
    color: COLORS.ink,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "80%",
    elevation: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairlineSoft,
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: FONT_VOGUE,
    fontSize: 22,
    letterSpacing: -0.3,
    color: COLORS.ink,
    lineHeight: 26,
  },
  modalSub: {
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairlineSoft,
  },
  logLeft: { flexDirection: "row", alignItems: "center" },
  logIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 12,
  },
  logDate: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: COLORS.ink,
  },
  logTime: {
    fontFamily: FONT_REGULAR,
    fontSize: 11,
    color: COLORS.mutedSoft,
    marginTop: 2,
  },
  logBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  logBadgePresent: { backgroundColor: COLORS.successSoft },
  logBadgeAbsent: { backgroundColor: COLORS.errorSoft },
  logBadgeText: { fontFamily: FONT_MEDIUM, fontSize: 11 },
  emptyLogWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptyLogText: {
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    color: COLORS.mutedSoft,
    textAlign: "center",
  },

  /* Admin PIN & Form Modal Styles */
  pinInput: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 12,
    paddingVertical: 14,
    textAlign: "center",
    fontFamily: FONT_BOLD,
    fontSize: 24,
    letterSpacing: 10,
    color: COLORS.ink,
  },
  pinInputError: {
    borderColor: COLORS.error,
  },
  pinErrorText: {
    fontFamily: FONT_REGULAR,
    fontSize: 11.5,
    color: COLORS.error,
    textAlign: "center",
    marginTop: 6,
  },
  adminSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  adminSubmitBtnText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 14,
    color: COLORS.onDark,
  },

  formLabel: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: COLORS.body,
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    color: COLORS.ink,
  },
  formRow2: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formYearRow: {
    flexDirection: "row",
    gap: 8,
  },
  formYearBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  formYearBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  formYearBtnText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 12,
    color: COLORS.muted,
  },
  formYearBtnTextActive: {
    color: COLORS.onDark,
  },
  resetPdfsLink: {
    alignItems: "center",
    paddingVertical: 14,
  },
  resetPdfsLinkText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: COLORS.muted,
    textDecorationLine: "underline",
  },
  archiveAdminTools: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  adminToolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  adminToolBtnText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11.5,
    color: COLORS.body,
  },
  localTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    marginRight: 6,
  },
  localTagText: {
    fontFamily: FONT_BOLD,
    fontSize: 9.5,
    color: "#059669",
    letterSpacing: 0.5,
  },

  /* Upload Mode Toggle */
  uploadModeToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.surfacePill,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  uploadModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  uploadModeBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  uploadModeBtnText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: COLORS.muted,
  },
  uploadModeBtnTextActive: {
    color: COLORS.onDark,
    fontFamily: FONT_SEMIBOLD,
  },

  /* File Drop Zone */
  fileDrop: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.hairline,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.canvas,
    marginBottom: 16,
    gap: 8,
  },
  fileDropLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 14,
    color: COLORS.body,
  },
  fileDropHint: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11.5,
    color: COLORS.muted,
    letterSpacing: 0.4,
  },
  fileDropName: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 13.5,
    color: COLORS.ink,
    textAlign: "center",
    marginTop: 4,
  },
  fileDropMeta: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11.5,
    color: COLORS.muted,
  },

  /* Upload Divider */
  uploadDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  uploadDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.hairline,
  },
  uploadDividerText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 10,
    color: COLORS.muted,
    letterSpacing: 1.2,
  },

  /* In-App PDF Viewer */
  pdfViewerContainer: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44,
  },
  pdfViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pdfViewerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfViewerTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  pdfViewerTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: COLORS.ink,
  },
  pdfViewerSubtitle: {
    fontFamily: FONT_REGULAR,
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  pdfViewerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pdfViewerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfViewerReloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfViewerBody: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  pdfViewerWebview: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  pdfViewerLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pdfViewerLoadingText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: COLORS.body,
    marginTop: 12,
  },
  pdfViewerErrorWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 10,
  },
  pdfViewerErrorTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    color: COLORS.ink,
    marginTop: 10,
    textAlign: "center",
  },
  pdfViewerErrorSub: {
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  pdfViewerRetryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  pdfViewerRetryBtnText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 12.5,
    color: COLORS.onDark,
  },
});
