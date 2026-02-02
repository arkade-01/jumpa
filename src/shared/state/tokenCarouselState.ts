interface TokenCarouselState {
  currentIndex: number;
  tokenAddresses: string[];
}

const carouselState = new Map<number, TokenCarouselState>();
const CAROUSEL_STATE_TTL = 30 * 60 * 1000; // 30 minutes

export function setCarouselState(userId: number, state: TokenCarouselState) {
  carouselState.set(userId, state);
  setTimeout(() => {
    carouselState.delete(userId);
  }, CAROUSEL_STATE_TTL);
}

export function getCarouselState(userId: number): TokenCarouselState | undefined {
  return carouselState.get(userId);
}

export function clearCarouselState(userId: number) {
  carouselState.delete(userId);
}

export function navigateCarousel(userId: number, direction: 'next' | 'prev'): number {
  const state = carouselState.get(userId);
  if (!state) return 0;

  let newIndex = state.currentIndex;
  if (direction === 'next') {
    newIndex = Math.min(state.currentIndex + 1, state.tokenAddresses.length - 1);
  } else {
    newIndex = Math.max(state.currentIndex - 1, 0);
  }

  // Update state with new index
  state.currentIndex = newIndex;
  carouselState.set(userId, state);

  return newIndex;
}
