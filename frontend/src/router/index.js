import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import GameBoard from '../views/GameBoard-v2.vue';
import PlayerRackView from '../views/PlayerRackView-v2.vue';
import FreePlay from '../views/FreePlay.vue';
import GameHistory from '../views/GameHistory.vue';
import GameReplay from '../views/GameReplay.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/game',
    name: 'game',
    component: GameBoard
  },
  {
    path: '/freeplay',
    name: 'freeplay',
    component: FreePlay
  },
  {
    path: '/rack/:playerId',
    name: 'rack',
    component: PlayerRackView,
    props: true
  },
  {
    path: '/history',
    name: 'history',
    component: GameHistory
  },
  {
    path: '/replay/:gameId',
    name: 'replay',
    component: GameReplay,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
