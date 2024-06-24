export const ANSWER = (
  message: string | number = '',
  message2: string | number = '',
) => {
  return {
    NOT_ENOUGH_MONEY: "Vous n'avez pas assez d'argent.",
    NOT_ON_THE_CASE:
      "Vous n'êtes pas sur la bonne case pour effectuer cette action.",
    CASINO_WIN: `Vous avez gagné ${message.toString()} au casino.`,
    CASINO_LOOSE: `Vous avez perdu ${message.toString()} au casino.`,
    AUCTION_SET: `Vous avez surenchéri ${message.toString()} sur cette enchère.`,
    AUCTION_SURPASSED:
      `Vous avez été surpassé sur l'enchère de ` +
      message.toString() +
      ` par ` +
      message2.toString() +
      `.`,
    HOUSE_REPAIR: `Vous avez réparé votre maison pour ${message.toString()}.`,
  };
};
