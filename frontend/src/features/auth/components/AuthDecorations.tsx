import { CaptionStack } from '@/components/brand/CaptionStack'
import { cn } from '@/lib/cn'

export type AuthVariant = 'login' | 'register'

/** Caption stacks per screen, taken from the copy baked into each backdrop. */
const CAPTIONS: Record<AuthVariant, { items: readonly string[]; index?: string }[]> = {
  login: [
    { items: ['Art', 'Frames', 'Prints', 'Wall decor'] },
    { index: '01', items: ['Design', 'Personalise', 'Frame', 'Display'] },
  ],
  // Register's steps are shown by AuthTagline, so its edges use the brand's gallery-label captions.
  register: [
    { items: ['Art', 'Frames', 'Prints', 'Wall decor'] },
    { index: '02', items: ['People', 'Places', 'Stories', 'Always art'] },
  ],
}

/**
 * Decorative layer for the image-free layout (phones, portrait tablets): the mockups' soft mint
 * arcs, a sage colour block and, from md, the gallery-label caption stacks at the page edges.
 * Mirrored for Register so each screen keeps its own composition. Hidden from assistive tech.
 */
export function AuthDecorations({ variant }: { variant: AuthVariant }) {
  const mirror = variant === 'register'
  const [top, bottom] = CAPTIONS[variant]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
      {/* Two overlapping arcs, like the light-washed arches behind the login card. */}
      <span
        className={cn(
          'absolute -top-28 size-[24rem] rounded-full bg-mist-200/70 sm:-top-40 sm:size-[38rem]',
          mirror ? '-right-40 sm:-right-56' : '-left-40 sm:-left-56',
        )}
      />
      <span
        className={cn(
          'absolute top-24 size-[20rem] rounded-full bg-sage-200/40 sm:top-40 sm:size-[30rem]',
          mirror ? '-right-52 sm:-right-72' : '-left-52 sm:-left-72',
        )}
      />
      {/* Sage block, the mockups' flat mint panels. */}
      <span
        className={cn(
          'absolute bottom-0 h-40 w-32 bg-sage-200/50 sm:h-72 sm:w-56',
          mirror ? 'left-0 rounded-tr-[5rem]' : 'right-0 rounded-tl-[5rem]',
        )}
      />
      {top && (
        <CaptionStack
          items={top.items}
          index={top.index}
          // Only where there's room beside the 32rem card (≥ 52rem wide), so it never tucks under it.
          className={cn('absolute top-16 hidden min-[52rem]:flex', mirror ? 'right-8' : 'left-8')}
        />
      )}
      {bottom && (
        <CaptionStack
          items={bottom.items}
          index={bottom.index}
          className={cn('absolute bottom-16 hidden lg:flex', mirror ? 'left-8' : 'right-8')}
        />
      )}
    </div>
  )
}
