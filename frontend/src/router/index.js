import { createRouter, createWebHistory } from 'vue-router';
import GameBoard from '../views/GameBoard.vue';
import PlayerRackView from '../views/PlayerRackView.vue';

const routes = [
  {
    path: '/',
    name: 'game',
    component: GameBoard
  },
  {
    path: '/rack/:playerId',
    name: 'rack',
    component: PlayerRackView,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
