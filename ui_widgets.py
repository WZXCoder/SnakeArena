import pygame


class Button:
    def __init__(
        self,
        rect: pygame.Rect,
        text: str,
        font: pygame.font.Font,
        bg=(30, 30, 30),
        fg=(255, 255, 255),
        hover_bg=(60, 60, 60),
        border=(255, 255, 255),
        border_width=2,
        radius=10,
    ):
        self.rect = rect
        self.text = text
        self.font = font
        self.bg = bg
        self.fg = fg
        self.hover_bg = hover_bg
        self.border = border
        self.border_width = border_width
        self.radius = radius

    def draw(self, screen: pygame.Surface):
        mouse_pos = pygame.mouse.get_pos()
        hovered = self.rect.collidepoint(mouse_pos)
        bg = self.hover_bg if hovered else self.bg

        pygame.draw.rect(screen, bg, self.rect, border_radius=self.radius)
        if self.border_width:
            pygame.draw.rect(
                screen,
                self.border,
                self.rect,
                width=self.border_width,
                border_radius=self.radius,
            )

        label = self.font.render(self.text, True, self.fg)
        label_rect = label.get_rect(center=self.rect.center)
        screen.blit(label, label_rect)

    def is_clicked(self, event: pygame.event.Event) -> bool:
        return (
            event.type == pygame.MOUSEBUTTONDOWN
            and event.button == 1
            and self.rect.collidepoint(event.pos)
        )

