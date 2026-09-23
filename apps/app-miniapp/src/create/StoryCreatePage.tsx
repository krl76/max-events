// START_MODULE_CONTRACT
// PURPOSE: Story publication screen (макет, экран 05): pick a photo, publish it to the stories rail, return to the feed.
// SCOPE: The photo path only. The place sticker, the poll and the audience controls of экран 05 are wave 9 (T-011) and are deliberately absent here rather than faked.
// DEPENDS: ../api/client.js (apiClient.createStory), ../routing/router.js (useRoute), ../ui/primitives.js (AppButton, AppState), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoryPublishState - idle | publishing | error
// - StoryCreateView - presentational: preview of the picked photo, publish button, error state
// - StoryCreatePage - container: file pick -> data URL -> apiClient.createStory -> back to the feed
// END_MODULE_MAP

import { useRef, useState } from "react";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { AppButton, AppState } from "../ui/primitives";

export type StoryPublishState = "idle" | "publishing" | "error";

interface StoryCreateViewProps {
  photoUrl: string | null;
  state: StoryPublishState;
  onPick: () => void;
  onPublish: () => void;
}

export function StoryCreateView({ photoUrl, state, onPick, onPublish }: StoryCreateViewProps) {
  return (
    <section className="app-story-create">
      {photoUrl === null ? <AppState hint="Фото живёт в истории сутки">Выберите фото для истории</AppState> : <img className="app-story-create-preview" src={photoUrl} alt="Фото истории" />}
      {state === "error" && <AppState error>Не удалось опубликовать историю. Попробуйте ещё раз.</AppState>}
      <div className="app-story-create-actions">
        <AppButton tone="secondary" stretched onClick={onPick}>
          {photoUrl === null ? "Выбрать фото" : "Другое фото"}
        </AppButton>
        <AppButton stretched disabled={photoUrl === null || state === "publishing"} onClick={onPublish}>
          В историю
        </AppButton>
      </div>
    </section>
  );
}

export function StoryCreatePage() {
  const { navigate } = useRoute();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [state, setState] = useState<StoryPublishState>("idle");

  const publish = () => {
    if (photoUrl === null) return;
    setState("publishing");
    apiClient.createStory(photoUrl).then(
      () => navigate({ name: "home" }),
      () => setState("error"),
    );
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Выбрать фото для истории"
        hidden
        onChange={(change) => {
          const file = change.target.files?.[0];
          change.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              setPhotoUrl(reader.result);
              setState("idle");
            }
          };
          reader.readAsDataURL(file);
        }}
      />
      <StoryCreateView photoUrl={photoUrl} state={state} onPick={() => fileRef.current?.click()} onPublish={publish} />
    </>
  );
}
