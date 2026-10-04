import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/Home.vue';
import GameBoard from '../views/GameBoard-v2.vue';
import PlayerRackView from '../views/PlayerRackView-v2.vue';
import FreePlay from '../views/FreePlay.vue';
import PracticeMode from '../views/PracticeMode.vue';
import FlashcardPractice from '../views/FlashcardPractice.vue';
import GameHistory from '../views/GameHistory.vue';
import GameReplay from '../views/GameReplay.vue';
import OddOneOutMode from '../views/OddOneOutMode.vue';
import OddOneOutMobile from '../views/OddOneOutMobile.vue';
import Host from '../views/Host.vue';
import Join from '../views/Join.vue';

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
    path: '/practice',
    name: 'practice',
    component: PracticeMode
  },
  {
    path: '/flashcards',
    name: 'flashcards',
    component: FlashcardPractice
  },
  {
    path: '/odd-one-out',
    name: 'odd-one-out',
    component: OddOneOutMode
  },
  {
    path: '/odd-one-out-mobile',
    name: 'odd-one-out-mobile',
    component: OddOneOutMobile
  },
  {
    path: '/host',
    name: 'host',
    component: Host
  },
  {
    path: '/join',
    name: 'join',
    component: Join
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
  history: createWebHashHistory(),
  routes
});

export default router;
