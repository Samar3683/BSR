/**
 * The event a scene of the film dispatches on itself when its scroll
 * progress changes (detail: 0 → 1). Written by the SceneDirector
 * (features/story), read by media that follow the scroll (MediaSequence).
 */
export const SCENE_PROGRESS_EVENT = "sceneprogress";
