// START_MODULE_CONTRACT
// PURPOSE: One honest sentence for every screen that goes empty because the friend graph is empty.
// SCOPE: FRIENDS_GRAPH_EMPTY_TEXT — the reason, not a shrug: MAX exposes no friends list to mini apps (checked against https://dev.max.ru/docs/webapps/bridge), so POST /friends/sync has nothing to import and the graph stays empty.
// DEPENDS: none
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FRIENDS_GRAPH_EMPTY_TEXT - shared empty-graph explanation
// END_MODULE_MAP

export const FRIENDS_GRAPH_EMPTY_TEXT = "Друзей пока нет: MAX не передаёт мини-приложениям список друзей из мессенджера.";
