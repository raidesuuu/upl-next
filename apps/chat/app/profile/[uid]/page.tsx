"use client";

import {
  MessageDataInterface,
  MessageElementDataInterface,
  SubscriptionDataInterface,
  UserDataInterface,
  returnSettingsJson,
} from "@/util/raiChatTypes";
import { auth, database, firestore } from "@/util/firebaseConfig";
import { getPlan, isCheckmarker } from "@/util/rai";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@shadcn/button";
import { Input } from "@shadcn/input";
import { Textarea } from "@shadcn/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@shadcn/alert-dialog";
import { User, onAuthStateChanged, updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import React, { useState, useEffect } from "react";
import {
  endAt,
  orderByChild,
  ref,
  query as queryDb,
  startAt,
  onChildAdded,
} from "firebase/database";
import MessageElement from "@/components/MessageElement";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@shadcn/popover";
import Image from "next/image";
import { Check, Edit, Gavel, MinusCircle, PlusCircle, UserIcon } from "lucide-react";

const ProfilePage = () => {
  const router = useRouter();
  const params = useParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editPicture, setEditPicture] = useState("");
  const [editBio, setEditBio] = useState("");
  const [currentBio, setCurrentBio] = useState("");
  const [currentHandle, setCurrentHandle] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [userData, setUserData] = useState<UserDataInterface | null>(null);
  const [userMessages, setUserMessages] = useState<
    MessageElementDataInterface[]
  >([]);
  const [alertText, setAlertText] = useState("");
  const [isFollowButtonDisabled, setIsFollowButtonDisabled] = useState(false);

  const handleEditClick = () => {
    if (!currentUser) return;

    setEditPicture(currentUser.photoURL || "");
    setEditName(currentUser.displayName || "");
    setEditBio(currentBio.replace(/<br>/g, "\n"));
    setEditHandle(currentHandle);
  };

  const handleFollowClick = async (userId: string) => {
    if (!currentUser || userId === currentUser.uid) return;
    setIsFollowButtonDisabled(true);

    try {
      const followDoc = doc(
        firestore,
        "raichat-user-status",
        userId,
        "followersInfo",
        currentUser.uid
      );
      const followData = await getDoc(followDoc);

      if (followData.exists()) {
        await handleUnfollow(userId);
      } else {
        await handleFollow(userId);
      }
    } finally {
      setIsFollowButtonDisabled(false);
    }
  };

  const handleUnfollow = async (userId: string) => {
    const userDoc = doc(firestore, "raichat-user-status", userId);
    const userData = (await getDoc(userDoc)).data() as UserDataInterface;

    const newFollowers = (userData.followers || 0) - 1;
    await setDoc(userDoc, { ...userData, followers: newFollowers });
    await deleteDoc(
      doc(
        firestore,
        "raichat-user-status",
        userId,
        "followersInfo",
        currentUser!.uid
      )
    );

    setFollowers(newFollowers);
    setIsFollowing(false);
  };

  const handleFollow = async (userId: string) => {
    const userDoc = doc(firestore, "raichat-user-status", userId);
    const userData = (await getDoc(userDoc)).data() as UserDataInterface;

    const newFollowers = (userData.followers || 0) + 1;
    await setDoc(userDoc, { ...userData, followers: newFollowers });
    await setDoc(
      doc(
        firestore,
        "raichat-user-status",
        userId,
        "followersInfo",
        currentUser!.uid
      ),
      { followed: true }
    );

    setFollowers(newFollowers);
    setIsFollowing(true);
  };

  const handleEditConfirm = async (userId: string) => {
    if (!currentUser || userId !== currentUser.uid) return;

    const handleQuery = query(
      collection(firestore, "raichat-user-status"),
      where("handle", "==", editHandle)
    );

    const docData = await getDocs(handleQuery);

    if (!docData.empty && editHandle !== currentHandle) {
      setAlertText("ハンドルは、既に使用されています。");
      return;
    }

    if (!editName) {
      setAlertText("ユーザー名は必須です。");
      return;
    }

    if (editName.length > 30) {
      setAlertText("ユーザー名は30文字以内である必要があります。");
      return;
    }

    if (editHandle.length > 12) {
      setAlertText("ハンドルは、12文字以内である必要があります。");
      return;
    }

    if (editBio.length > 500) {
      setAlertText("自己紹介は500文字以内である必要があります。");
      return;
    }
    try {
      await updateProfile(currentUser, {
        displayName: editName,
        photoURL: editPicture || null,
      });

      const userDoc = doc(firestore, "raichat-user-status", currentUser.uid);
      const currentUserData = (
        await getDoc(userDoc)
      ).data() as UserDataInterface;

      const updatedUserData = {
        ...currentUserData,
        verified:
          editName === currentUserData.username
            ? currentUserData.verified
            : false,
        image: editPicture || null,
        username: editName,
        handle: editHandle,
        bio: editBio || null,
      };

      await setDoc(userDoc, updatedUserData);
      setUserData(updatedUserData);
    } catch (error) {
      setAlertText(`プロフィールの変更に失敗しました。${error}`);
    }
  };

  useEffect(() => {
    const handleAuth = async (user: import("firebase/auth").User | null) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUser(user);
      if (!params) {
        router.push("/home");
        return;
      }
      let uid = params.uid as string;

      if (!uid) {
        router.push("/home");
        return;
      }

      if (uid === "me") uid = user.uid;
      if (uid === "rai") uid = "RCkd5bljG8WSIdYe4NUwILmUfHk1";

      const userDoc = await getDoc(doc(firestore, "raichat-user-status", uid));
      if (!userDoc.exists()) {
        router.push("/home");
        return;
      }

      const userData = userDoc.data() as UserDataInterface;
      setUserData(userData);
      setFollowers(userData.followers || 0);
      setCurrentBio(userData.bio || "");
      setCurrentHandle(userData.handle || "");

      const followDoc = await getDoc(
        doc(firestore, "raichat-user-status", uid, "followersInfo", user.uid)
      );
      setIsFollowing(followDoc.exists());

      const settingsDoc = await getDoc(
        doc(firestore, "rai-user-settings", user.uid)
      );
      if (!settingsDoc.exists()) {
        await setDoc(
          doc(firestore, "rai-user-settings", user.uid),
          returnSettingsJson()
        );
      }
      const settingData = settingsDoc.data();

      const subscriptionDoc = await getDoc(
        doc(firestore, "subscription-state", user.uid)
      );
      if (subscriptionDoc.exists()) {
        const subData = subscriptionDoc.data() as SubscriptionDataInterface;

        setIsStaff(subData.isStaff);

        if (getPlan(subData.plan) != "pro" && getPlan(subData.plan) != "premiumplus") {
          router.push("/");
          return;
        }
      } else {
        router.push("/");
        return;
      }

      const userMessagesRef = ref(database, "messages_new_20240630/");
      const userMessagesQuery = queryDb(
        userMessagesRef,
        orderByChild("uid"),
        startAt(uid),
        endAt(user.uid)
      );

      onChildAdded(userMessagesQuery, (snapshot) => {
        const messageData = snapshot.val() as MessageDataInterface;
        if (messageData.replyTo) return;

        if (!userData) return;

        const newMessage: MessageElementDataInterface = {
          userData,
          messageData,
          user: user,
          userSettings: settingData,
        };

        setUserMessages((prev) => [newMessage, ...prev]);
      });
    };

    const unsubscribe = onAuthStateChanged(auth, handleAuth);
    return () => unsubscribe();
  }, [router, params]);

  if (!userData || !currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <main className="p-5 w-full">
      <div className="mx-auto">
        <div className="flex flex-col gap-2">
          <Image
            src={userData.image || "/images/chat-defaultProfile.png"}
            alt="Profile"
            width={128}
            height={128}
            className="w-32 h-32 rounded-full"
          />

          <h1 className="text-2xl font-bold flex items-center">
            {userData.username}
            {isCheckmarker(userData) && (
              <Popover>
                <PopoverTrigger asChild className="ml-2">
                  {userData.isStaff ? (
                    <Gavel className="admin text-yellow-400" />
                  ) : userData.isGov ? (
                    <Check className="gov text-neutral-400" />
                  ) : userData.isStudent ? (
                    <UserIcon className="student text-green-400" />
                  ) : (
                    <Check className="verified text-blue-400" />
                  )}
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex items-start gap-2">
                    {userData.isStaff ? (
                      <Gavel className="admin text-yellow-400 size-8" />
                    ) : userData.isGov ? (
                      <Check className="gov text-neutral-400 size-8" />
                    ) : userData.isStudent ? (
                      <UserIcon className="student text-green-400 size-8" />
                    ) : (
                      <Check className="verified text-blue-400 size-8" />
                    )}
                    {userData.isStaff
                      ? "このアカウントは、Rai Chat のスタッフのアカウントであるため認証されています。"
                      : userData.isGov
                      ? "このアカウントは、政府または多国間機関のアカウントであるため認証されています。"
                      : userData.isStudent
                      ? "このアカウントは、学生特典が有効なアカウントであるため認証されています。"
                      : "このアカウントは、プレミアムを購入しているアカウントであるため認証されています。"}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </h1>

          <p className="text-gray-500">
            @{userData.handle || "ハンドルがありません"}
          </p>

          <p>{userData.bio || "自己紹介がありません"}</p>

          <p className="text-gray-500">{followers} フォロワー</p>

          {currentUser.uid === userData.uid ? (
            <AlertDialog onOpenChange={handleEditClick}>
              <AlertDialogTrigger asChild>
                <Button className="flex w-full sm:w-fit">
                  <Edit />
                  プロフィールを編集
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader>
                  <AlertDialogTitle>プロフィールを編集</AlertDialogTitle>
                  <AlertDialogDescription>
                    プロフィール情報を更新します。
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      プロフィール画像URL
                    </label>
                    <Input
                      type="url"
                      value={editPicture}
                      onChange={(e) => setEditPicture(e.target.value)}
                      placeholder="画像のURL"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      名前
                    </label>
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="あなたの名前"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      ハンドル
                    </label>
                    <Input
                      type="text"
                      value={editHandle}
                      onChange={(e) => setEditHandle(e.target.value)}
                      placeholder="あなたのハンドル"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      自己紹介
                    </label>
                    <Textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="自己紹介"
                      disabled={!userData.paid}
                    />
                    {!userData.paid && (
                      <p className="text-sm text-gray-500 mt-1">
                        自己紹介はプレミアム会員のみ編集できます
                      </p>
                    )}
                  </div>

                  {alertText && <p className="text-red-500">{alertText}</p>}
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleEditConfirm(userData.uid)}
                  >
                    保存
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              disabled={isFollowButtonDisabled}
              onClick={() => handleFollowClick(userData.uid)}
              className="flex items-center gap-2"
            >
              {isFollowing ? <MinusCircle /> : <PlusCircle />}
              {isFollowing ? "フォロー中" : "フォローする"}
            </Button>
          )}

          <div className={`flex flex-col gap-4 mt-3`}>
            {userMessages.map((msg, index) => (
              <MessageElement
                key={`${msg.messageData.id}-${index}`}
                userData={msg.userData}
                messageData={msg.messageData}
                user={msg.user}
                userSettings={msg.userSettings}
                isStaff={isStaff}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default ProfilePage;