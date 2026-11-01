import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type OrderMailProps = {
  preview: string;
  heading: string;
  intro: string;
  orderNumber: number;
  dropTitle: string;
  pickup: string;
  location: string | null;
  /** Abholcode nur bei bestätigten Bestellungen */
  pickupCode: string | null;
  items: { label: string; price: string }[];
  total: string;
  link: string;
  linkLabel: string;
};

// Farben der Toskana-Palette; Mail-Clients brauchen Inline-Styles.
const paper = "#f7f2e8";
const ink = "#2b2620";
const muted = "#6f665a";
const line = "#e3d9c6";
const olive = "#5c6a3a";
const terracotta = "#a24a33";

export function OrderMail(props: OrderMailProps) {
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
          <Text style={{ color: muted, fontSize: 16 }}>{props.intro}</Text>

          {props.pickupCode && (
            <Section
              style={{
                border: `1px solid ${line}`,
                borderRadius: 6,
                padding: "16px 20px",
                margin: "20px 0",
                backgroundColor: "#fcfaf5",
              }}
            >
              <Text style={{ color: muted, fontSize: 13, margin: 0 }}>
                Abholcode
              </Text>
              <Text
                style={{
                  fontSize: 32,
                  letterSpacing: 6,
                  fontWeight: 700,
                  margin: "4px 0 0",
                }}
              >
                {props.pickupCode}
              </Text>
            </Section>
          )}

          <Text style={{ fontSize: 15, margin: "16px 0 4px" }}>
            <strong>Bestellung {props.orderNumber}</strong> · {props.dropTitle}
          </Text>
          <Text style={{ fontSize: 15, margin: 0, color: terracotta }}>
            Abholung {props.pickup}
          </Text>
          {props.location && (
            <Text style={{ fontSize: 15, margin: "4px 0 0", color: muted }}>
              {props.location}
            </Text>
          )}

          <Hr style={{ borderColor: line, margin: "20px 0" }} />
          {props.items.map((item) => (
            <Text key={item.label} style={{ fontSize: 15, margin: "4px 0" }}>
              {item.label}
              <span style={{ float: "right" }}>{item.price}</span>
            </Text>
          ))}
          <Hr style={{ borderColor: line, margin: "12px 0" }} />
          <Text style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Summe
            <span style={{ float: "right" }}>{props.total}</span>
          </Text>

          <Button
            href={props.link}
            style={{
              backgroundColor: olive,
              color: "#fcfaf5",
              borderRadius: 6,
              padding: "12px 20px",
              fontSize: 15,
              marginTop: 28,
            }}
          >
            {props.linkLabel}
          </Button>
          <Text style={{ color: muted, fontSize: 12, marginTop: 32 }}>
            Diese Mail gehört zu deiner Bestellung bei Pizza Drop. Antworte
            einfach, wenn du Fragen hast.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
