import { defineModule } from "@rp-cli/core";
import { z } from "zod";

const ModelSchema = z.object({
  profile: z
    .object({
      name: z.string().optional(),
      age: z.number().optional(),
      personality: z.array(z.string()).optional()
    })
    .catchall(z.unknown())
    .default({}),
  mood: z
    .object({
      label: z.string().optional(),
      valence: z.number().min(-1).max(1).optional(),
      arousal: z.number().min(0).max(1).optional(),
      stress: z.number().min(0).max(1).optional()
    })
    .catchall(z.unknown())
    .default({}),
  relationships: z
    .record(
      z.string(),
      z
        .object({
          affection: z.number().min(0).max(100).optional(),
          trust: z.number().min(0).max(100).optional(),
          notes: z.array(z.string()).default([])
        })
        .catchall(z.unknown())
    )
    .default({}),
  level: z.number().min(0).default(1),
  wear: z
    .object({
      top: z.string().optional(),
      bottom: z.string().optional(),
      underwear: z.string().optional(),
      accessory: z.string().optional()
    })
    .catchall(z.unknown())
    .default({})
});

function getCharacterName(model) {
  return model.profile.name ?? "Mio";
}

function randomStress() {
  return Number((0.2 + Math.random() * 0.4).toFixed(3));
}

export default defineModule({
  name: "life-sim",
  version: 1,
  model: {
    version: 1,
    schema: ModelSchema,
    defaults: () => ({
      profile: {},
      mood: {},
      relationships: {},
      level: 1,
      wear: {}
    }),
    migrate: ({ model }) => ModelSchema.parse(model)
  },
  actions: {
    setMood: {
      description: "Update current mood.",
      input: z.object({
        label: z.string().optional(),
        valence: z.number().min(-1).max(1).optional(),
        arousal: z.number().min(0).max(1).optional(),
        stress: z.number().min(0).max(1).optional()
      }),
      run({ model, input }) {
        for (const [key, value] of Object.entries(input)) {
          model.mood[key] = value;
        }

        return {
          reason: "Mood fields were updated.",
          result: "Mood updated."
        };
      }
    },
    setLevel: {
      description: "Set the character level.",
      input: z.object({
        level: z.number().min(0)
      }),
      run({ model, input }) {
        model.level = input.level;

        return {
          reason: "Level was updated.",
          result: `Level set to ${input.level}.`
        };
      }
    },
    levelUp: {
      description: "Increase level by 1.",
      input: z.object({}),
      run({ model }) {
        model.level += 1;

        return {
          reason: "Character leveled up.",
          result: `Level up! Now level ${model.level}.`
        };
      }
    },
    setWear: {
      description: "Update worn items.",
      input: z.object({
        top: z.string().optional(),
        bottom: z.string().optional(),
        underwear: z.string().optional(),
        accessory: z.string().optional()
      }),
      run({ model, input }) {
        for (const [key, value] of Object.entries(input)) {
          model.wear[key] = value;
        }

        return {
          reason: "Wear was updated.",
          result: "Wear updated."
        };
      }
    },
    removeWear: {
      description: "Remove a worn item.",
      input: z.object({
        slot: z.enum(["top", "bottom", "underwear", "accessory"])
      }),
      run({ model, input }) {
        delete model.wear[input.slot];

        return {
          reason: `${input.slot} was removed.`,
          result: `${input.slot} removed.`
        };
      }
    }
  },
  views: {
    summary({ model }) {
      return {
        result: {
          profile: model.profile,
          mood: model.mood,
          relationshipCount: Object.keys(model.relationships).length,
          level: model.level,
          wear: model.wear
        }
      };
    },
    MioBackground({ model }) {
      const name = getCharacterName(model);

      return {
        result: {
          name,
          background: `${name} is the focus of a slice-of-life roleplay. Keep scenes grounded in current feelings, simple daily details, and continuity from the model state.`,
          currentMood: model.mood,
          level: model.level,
          wearing: model.wear
        }
      };
    },
    MioMood({ model }) {
      if (model.mood.stress === undefined || model.mood.stress < 0.5) {
        model.mood.stress = randomStress();
      }

      return {
        result: {
          name: getCharacterName(model),
          label: model.mood.label,
          valence: model.mood.valence,
          arousal: model.mood.arousal,
          stress: model.mood.stress
        }
      };
    }
  }
});
