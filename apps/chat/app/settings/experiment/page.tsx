"use client";

import { useEffect, useState } from "react";
import { Button } from "@shadcn/button";
import { useTitle } from "@/hooks/use-title";
import { Label } from "@shadcn/label";
import { Switch } from "@shadcn/switch";
import Link from "next/link";
import { auth, firestore } from "@/util/firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  returnSettingsJson,
  SubscriptionDataInterface,
} from "@/util/raiChatTypes";
import { Badge } from "@shadcn/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@shadcn/breadcrumb";
import { useRouter } from "next/navigation";
import { getPlan } from "@/util/rai";
import { History } from "lucide-react";

const SettingsExperiment: React.FC = () => {
  // State Management
  const router = useRouter();
  const [premiumHighlight, setPremiumHighlight] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [userObject, setUserObject] = useState({} as User);

  useTitle("実験中の機能 | 設定");

  const setHighlight = () => {
    const changeTo = !premiumHighlight;
    setPremiumHighlight(changeTo);
    editSettings("premiumHighlight", changeTo);
  };

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserObject(user);

        const settingDoc = await getDoc(
          doc(firestore, "rai-user-settings", user.uid)
        );
        if (!settingDoc.exists()) {
          await setDoc(
            doc(firestore, "rai-user-settings", user.uid),
            returnSettingsJson()
          );
        }
        const settingData = settingDoc.data();

        const premiumDoc = await getDoc(
          doc(firestore, "subscription-state", user.uid)
        );
        if (premiumDoc.exists()) {
          const subData = premiumDoc.data() as SubscriptionDataInterface;
          if (getPlan(subData.plan) != "pro" && getPlan(subData.plan) != "premiumplus") {
            router.push("/");
            return;
          }
          setIsPremium(
            (subData.plan as string) != "free" &&
              (subData.plan as string) != "premium"
          );
          if (settingData) {
            setPremiumHighlight(settingData.premiumHighlight);
          }
        }
      } else {
        window.location.href = "/login";
      }
    });
  });

  const editSettings = async (
    setting: string,
    value: boolean | string | number
  ) => {
    setIsChanging(true);

    const settingsDoc = doc(firestore, "rai-user-settings", userObject.uid);
    const settingDoc = await getDoc(settingsDoc);
    const settingData = settingDoc.data();
    if (settingData) {
      settingData[setting] = value;
      await setDoc(settingsDoc, settingData);

      setIsChanging(false);
    }
  };

  return (
    <main className={`p-5 w-full`}>
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">ホーム</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">設定</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>実験中の機能</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="text-3xl font-semibold mb-1">実験中の機能</h1>
      <p className="mb-3">機能の有効／無効を切り替えたりすることができます。</p>

      <div className="flex flex-col gap-4">
        <div className="bg-card border shadow w-auto p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Switch
              id="premium-highlight"
              checked={premiumHighlight}
              disabled={isChanging || !isPremium}
              onCheckedChange={() => setHighlight()}
            />
            <Label
              htmlFor="premium-highlight"
              className="text-xl items-center flex"
            >
              メッセージの強調表示{" "}
              <Badge className="ml-1">プレミアムプラス</Badge>
            </Label>
          </div>
          {isPremium ? (
            <p>
              メッセージをの周りを金色にすることで、メッセージを強調表示します。
            </p>
          ) : (
            <p>
              メッセージの強調表示有効にするには、プレミアムプラス以上のサブスクリプションに登録する必要があります。
            </p>
          )}
        </div>

        <div className="bg-card shadow border w-auto p-4 rounded-lg">
          <Label className="text-xl items-center flex">
            新しい Rai Chat <Badge className="ml-1">プレミアムプラス</Badge>
          </Label>{" "}
          <p className="mb-1">
            新しい Rai Chat
            は、新しいUI、機能、およびより多くの機能を備えています。（既にご利用中です）
          </p>
          <Button asChild>
            <Link href="https://raic.tech/chat/" target="_blank">
              <History />
              旧バージョンの Rai Chat
            </Link>
          </Button>
        </div>

        <div className="bg-card shadow border w-auto p-4 rounded-lg">
          <Label className="text-xl">アカウントの設定</Label>
          <p className="mb-1">
            アカウントの設定・サブスクリプションの変更は、
            以下のリンクから可能です。
          </p>
          <Button asChild>
            <Link href="/account">アカウントの設定</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default SettingsExperiment;
