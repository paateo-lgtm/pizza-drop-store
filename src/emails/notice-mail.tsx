import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

export type NoticeMailProps = {
  preview: string;
  heading: string;
  paragraphs: string[];
  link: string;
  linkLabel: string;
  /** Pflicht in Werbe-Mails (Drop-Alarm): Abmelden mit einem Klick */
  unsubscribeUrl?: string;
  footer: string;
};

// Farben der Toskana-Palette wie in der Bestellmail; Mail-Clients brauchen Inline-Styles.
const paper = "#f7f2e8";
const ink = "#2b2620";
const muted = "#6f665a";
const olive = "#5c6a3a";
const terracotta = "#a24a33";

/** Schlichte Hinweis-Mail mit einem Knopf, z. B. Drop-Alarm und Bestätigungslink. */
export function NoticeMail(props: NoticeMailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: paper,
          color: ink,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <Container style={{ maxWidth: 520, padding: "32px 20px" }}>
          <Text
            style={{
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: 22,
              margin: 0,
            }}
          >
            Pizza <span style={{ color: terracotta }}>Drop</span>
          </Text>
          <Heading
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 500,
              fontSize: 30,
              margin: "28px 0 8px",
            }}
          >
            {props.heading}
          </Heading>
          {props.paragraphs.map((text) => (
            <Text key={text} style={{ color: muted, fontSize: 16 }}>
              {text}
            </Text>
          ))}
          <Button
            href={props.link}
            style={{
              backgroundColor: olive,
              color: "#fcfaf5",
              borderRadius: 6,
              padding: "12px 20px",
              fontSize: 15,
              marginTop: 20,
            }}
          >
            {props.linkLabel}
          </Button>
          <Text style={{ color: muted, fontSize: 12, marginTop: 32 }}>
            {props.footer}
            {props.unsubscribeUrl && (
              <>
                {" "}
                <Link href={props.unsubscribeUrl} style={{ color: muted }}>
                  Vom Drop-Alarm abmelden
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
