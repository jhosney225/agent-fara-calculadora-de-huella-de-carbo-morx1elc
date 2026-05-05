
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface Activity {
  type: string;
  value: number;
  unit: string;
}

interface UserData {
  activities: Activity[];
  conversationHistory: Array<{ role: string; content: string }>;
}

const userData: UserData = {
  activities: [],
  conversationHistory: [],
};

// Conversion factors for carbon emissions (kg CO2e)
const emissionFactors: Record<string, number> = {
  car_km: 0.21, // kg CO2e per km
  flight_hour: 255, // kg CO2e per hour
  electricity_kwh: 0.45, // kg CO2e per kWh
  natural_gas_m3: 2.04, // kg CO2e per cubic meter
  meat_kg: 27, // kg CO2e per kg
  dairy_kg: 2.86, // kg CO2e per kg
  vegetables_kg: 0.5, // kg CO2e per kg
};

function calculateEmissions(activity: Activity): number {
  const factor = emissionFactors[`${activity.type}_${activity.unit}`];
  return factor ? activity.value * factor : 0;
}

function getTotalEmissions(): number {
  return userData.activities.reduce((total, activity) => {
    return total + calculateEmissions(activity);
  }, 0);
}

function formatEmissions(value: number): string {
  if (value > 1000) {
    return `${(value / 1000).toFixed(2)} toneladas CO2e`;
  }
  return `${value.toFixed(2)} kg CO2e`;
}

async function chat(userMessage: string): Promise<string> {
  userData.conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const systemPrompt = `Eres un asistente experto en cálculo de huella de carbono personal. 
Tu objetivo es ayudar al usuario a registrar sus actividades diarias y calcular su impacto ambiental.

Actividades registradas hasta ahora:
${userData.activities.length > 0 ? JSON.stringify(userData.activities, null, 2) : "Ninguna"}

Emisiones totales actuales: ${formatEmissions(getTotalEmissions())}

Cuando el usuario mencione una actividad, extrae los siguientes datos en formato JSON:
- type: tipo de actividad (car, flight, electricity, natural_gas, meat, dairy, vegetables)
- value: cantidad numérica
- unit: unidad (km, hour, kwh, m3, kg)

Responde de forma amigable y educativa. Si el usuario proporciona una actividad, 
calcula el impacto de carbono y da consejos para reducirlo.
Siempre responde en español.`;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: userData.conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Try to extract activity data from the response
  try {
    const jsonMatch = assistantMessage.match(/\{[\s\S]*?"type"[\s\S]*?\}/);
    if (jsonMatch) {
      const activityData = JSON.parse(jsonMatch[0]);
      if (
        activityData.type &&
        activityData.value &&
        activityData.unit &&
        emissionFactors[`${activityData.type}_${activityData.unit}`]
      ) {
        userData.activities.push(activityData);
      }
    }
  } catch (e) {
    // No activity data found, continue normally
  }

  userData.conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  return assistantMessage;
}

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🌍 Calculadora de Huella de Carbono Personal");
  console.log("==========================================");
  console.log(
    "Bienvenido! Soy tu asistente para calcular tu huella de carbono."
  );
  console.log(
    "Cuéntame sobre tus actividades diarias y te ayudaré a calcular tu impacto ambiental."
  );
  console.log('Escribe "salir" para terminar.\n');

  const askQuestion = (): void => {
    rl.question("Tú: ", async (input) => {
      const userInput = input.trim();

      if (userInput.toLowerCase() === "salir") {
        console.log("\n📊 Resumen Final:");
        console.log("================");
        console.log(`Actividades registradas: ${userData.activities.length}`);
        console.log(
          `Huella de carbono total: ${formatEmissions(getTotalEmissions())}`
        );

        if (userData.activities.length > 0) {
          console.log("\nDetalle de actividades:");
          userData.activities.forEach((activity, index) => {
            const emissions = calculateEmissions(activity);
            console.log(
              `${index + 1}. ${activity.type}: ${activity.value} ${activity.unit} = ${emissions.toFixed(2)} kg CO2e`
            );
          });
        }

        console.log(
          "\n¡Gracias por usar la Calculadora de Huella de Carbono! 🌱"
        );
        rl.close();
        return;
      }