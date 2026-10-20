package Main;
import java.util.Arrays;
import java.util.InputMismatchException;
import java.util.Random;
import java.util.Scanner;

import Enemies.EnemyGeneration;
import Loot.Armor;
import Loot.Generation;
import Loot.Weapon;
import Player.ClassType;
import Player.Player;
import Player.Variables;
import Town.Town;
import Player.Inventory;

public class Bots {
        public void tsung() {
        Scanner scanner = new Scanner(System.in);
        Player player = App.getPlayer();
        int choice = 0;
        String blessing = "";
        Boolean tsungBlessing = false;

        System.out.println("After some time you cross paths with a traveling monk.\n"
        + "Tsung: Hello there traveler, I am Tsung. I am on a pilgrimage to the temple of the gods.\n");
        System.out.println("1. Nice to meet you Tsung, I am " + player.getName());
        System.out.println("2. I don't have time for this, I must be on my way.");

        choice = scanner.nextInt();
        App.clearScreen();

        if (choice == 1) {
            System.out.println("Tsung: It is nice to meet you " + player.getName() + ".\n"
            + "It's getting late, why don't we set up camp together?\n");
            System.out.println("1. Sure, I could use the company.");
            System.out.println("2. No thanks, I prefer to travel alone.");

            choice = scanner.nextInt();
            App.clearScreen();

            if (choice == 1) {
                System.out.println("Tsung: Wonderful, I will start a fire!");
                System.out.println("Tsung starts a fire and you both sit around it.\n"
                + "Tsung: So " + player.getName() + ", what brings you out here?\n");
                System.out.println("1. I'm an adventurer it's kinda what I do.\n"
                + "2. I like to explore.\n" 
                + "3. On second thought this is a bad idea...\n");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1 || choice == 2) {
                    System.out.println("Tsung: You are most fascinating!\n"
                    + "Tsung: I am nothing but a monk, I have devoted my life to the gods and in return they\n"
                    + "have given me the ability to bless others. I praise and thank the gods everyday.\n");
                    System.out.println("1. That's great, I'm happy for you.\n" 
                    + "2. May the gods watch over us tonight\n"
                    + "3. I don't believe in the gods.\n");

                    choice = scanner.nextInt();
                    App.clearScreen();

                    if (choice == 2) {
                        System.out.println("Tsung: Thank you. I pray the gods shine upon you.\n");
                        tsungBlessing = true;
                        App.getVariables().setTsungBlessing(tsungBlessing);
                        
                    } 
                        System.out.println("Tsung: Let us rest now, we have a long journey ahead of us.\n");
                        System.out.println("1. Goodnight Tsung.");
                        choice = scanner.nextInt();
                        App.clearScreen();
                }
                else if (choice == 3) {
                    System.out.println("Tsung: I see, well I wish you luck on your travels.\n");
                    System.out.println("1. Continue");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    App.actionMenu();
                }
            }
            else if (choice == 2) {
                System.out.println("Tsung: I see, well I wish you luck on your travels.");
                System.out.println("1. Continue");
                choice = scanner.nextInt();
                App.clearScreen();
                App.actionMenu();
            }
        }  else if (choice == 2) {
            System.out.println("Tsung: I see, well I wish you luck on your travels.");
            System.out.println("1. Continue");
            choice = scanner.nextInt();
            App.clearScreen();
            App.actionMenu();
        }
        System.out.println("You and Tsung go to sleep.");
        System.out.println("1. Continue");
        choice = scanner.nextInt();
        App.clearScreen();

        if (tsungBlessing == false) {
            System.out.println("You wake up with a note on your chest.\n" 
            + "The note reads: Thank you for keeping me company last night. ~Tsung \n");
            System.out.println("By the now extinguished fire you find a small bag of gold.\n"
            + "You found 50 gold!");
            player.setGold(player.getGold() + 50);
            System.out.println("1. Continue");
            choice = scanner.nextInt();
            App.clearScreen();
            App.actionMenu();
        } else if (tsungBlessing == true)
            blessing = getTsungBlessing();    
            String[] newBlessings = Arrays.copyOf(player.getBlessings(), player.getBlessings().length + 1);

            switch (blessing) {
            case "Physique":
                for (int i = 0; i < player.getBlessings().length; i++) {
                    if (player.getBlessings()[i] == "Physique") {
                        blessing = "Nothing";
                        break;
                    }
                }
                player.setMaxStamina(player.getMaxStamina() + 10);
                player.setMaxHealth((int) (player.getMaxHealth() * 1.2));
                player.setStrength(player.getStrength() + 9);
                break;
            case "Character":
                for (int i = 0; i < player.getBlessings().length; i++) {
                    if (player.getBlessings()[i] == "Character") {
                        blessing = "Nothing";
                        break;
                    }
                }
                player.setIntelligence(player.getIntelligence() + 18);
                player.setResilience(player.getResilience() + 5);
                player.setPowerMax(player.getPowerMax() + 9);
                break;
            case "Fortitude":
                for (int i = 0; i < player.getBlessings().length; i++) {
                    if (player.getBlessings()[i] == "Fortitude") {
                        blessing = "Nothing";
                        break;
                    }
                }
                player.setVitality(player.getVitality() + 10);
                player.setDefense(player.getDefense() + (int) (player.getDefense() * 0.05));
                player.setMaxHealth((int) (player.getMaxHealth() * 1.1));
                break;
            case "Intuition":
                for (int i = 0; i < player.getBlessings().length; i++) {
                    if (player.getBlessings()[i] == "Intuition") {
                        blessing = "Nothing";
                        break;
                    }
                }
                player.setDexterity((int) (player.getDexterity() * 1.1));
                player.setIntelligence((int) (player.getIntelligence() * 1.1));
                player.setPowerMax(player.getPowerMax() + 12);
                break;
            case "Skillfulness":
                for (int i = 0; i < player.getBlessings().length; i++) {
                    if (player.getBlessings()[i] == "Skillfulness") {
                        blessing = "Nothing";
                        break;
                    }
                }
                player.setMaxStamina(player.getMaxStamina() + 10);
                player.setStrength(player.getStrength() + (int) (player.getStrength() * 0.05));
                player.setDexterity(player.getDexterity() + (int) (player.getDexterity() * 0.05));
                player.setIntelligence(player.getIntelligence() + (int) (player.getIntelligence() * 0.05));
                player.setAttackMax(player.getAttackMax() + (int) (player.getAttackMax() * 0.02));
                player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * 0.02));
                break;
            case "The Prodigy":
                for (int i = 0; i < player.getBlessings().length; i++) {
                    if (player.getBlessings()[i] == "The Prodigy") {
                        blessing = "Nothing";
                        break;
                    }
                }
                player.setExperienceMultiplier(player.getExperienceMultiplier() + 0.5);
                break;
        }
        
        if (blessing != "Nothing") {
            newBlessings[newBlessings.length - 1] = blessing;
            player.setBlessings(newBlessings);
        }

        System.out.println("You wake up to Tsung praying over you.\n"
        + "Tsung: The gods have blessed you with their favor my friend!\n"
        + "Tsung: You have been blessed with " + blessing + "!\n");

        switch (blessing) {
            case "Physique":
                System.out.println("Your max stamina has increased by 10!\n"
                + "Your health has increased by 20%!\n"
                + "Your strength has increased by 9!\n");
                break;
            case "Character":
                System.out.println("Your intelligence has increased by 18!\n"
                + "Your resilience has increased by 5!\n"
                + "Your max power has increased by 9!\n");
                break;
            case "Fortitude":
                System.out.println("Your vitality has increased by 10!\n"
                + "Your defense has increased by 5%!\n"
                + "Your max health has increased by 10%!\n");
                break;
            case "Intuition":
                System.out.println("Your dexterity has increased by 10%!\n"
                + "Your intelligence has increased by 10%!\n"
                + "Your max power has increased by 12!\n");
                break;
            case "Skillfulness":
                System.out.println("Your max stamina has increased by 10!\n"
                + "All Stats(STR/DEX/INT) have increased by 5%!\n"
                + "Your Attack Min & Max has increased by 2%!\n");
                break;
            case "The Prodigy":
                System.out.println("Your experience multiplier has increased by 50%!\n");
                break;
        }

        System.out.println("1. Thank you Tsung!");

        choice = scanner.nextInt();
        App.clearScreen();

        System.out.println("Tsung: It is the gods you should thank, not me.\n"
        + "Tsung: I must be on my way now, I wish you luck on your travels.\n" 
        + "Tsung: May the gods shine upon you.\n"
        + "Tsung begins to walk away.\n"
        + "Tsung: oh, do come to the temple of god when you get the chance!\n");
        System.out.println("1. I will Tsung, goodbye.\n");

        choice = scanner.nextInt();
        App.clearScreen();
        App.actionMenu();
        scanner.close();
    }

    public String getTsungBlessing() {
        Random random = new Random();
        int blessingNum = random.nextInt(6) + 1;
        String blessing = "";

        switch (blessingNum) {
            case 1:
                blessing = "Physique";
                break;
            case 2:
                blessing = "Character";
                break;
            case 3:
                blessing = "Fortitude";
                break;
            case 4:
                blessing = "Intuition";
                break;
            case 5:
                blessing = "Skillfulness";
                break;
            case 6:
                blessing = "The Prodigy";
                break;
        }
        return blessing;
    }

    public void diciplesOfXolgroth() {
        Scanner scanner = new Scanner(System.in);
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        Travel travel = App.getTravel();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Random random = new Random();
        int choice = 0;
        System.out.println("Cultists: You say you have been touched by our great lord Xolgroth?\n");
        System.out.println("1. Yes, I have been touched by the great Xolgroth.\n"
        + "2. No, im here to kill you. (Attack)");
        choice = scanner.nextInt();
        App.clearScreen();
        if (choice == 1) {
            int cultistsQuestion = random.nextInt(5) + 1;
            String[] newBlessings = Arrays.copyOf(player.getBlessings(), player.getBlessings().length + 1);
            System.out.println("Cultists: Prove yourself then...");

            switch (cultistsQuestion) {
                case 1:
                    System.out.println("How long has Xolgroth been imprisoned for?");
                    System.out.println("1. 50 Years\n"
                    + "2. 100 Years\n"
                    + "3. 500 Years\n"
                    + "4. 1000 Years");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    if (choice == 3) {
                        System.out.println("Cultists: You do know lord Xolgroth...\n" +
                        "Cultists: Please forgive our intrusion!");
                        if (variables.getXolgrothBlessing() == true) {
                            System.out.println("Cultists: Please accept this gift for our insolence.");
                            player.setSkillPoints(player.getSkillPoints() + 1);
                            System.out.println("You have gained and 3 stat points!");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        } else if (variables.getXolgrothBlessing() == false) {
                            System.out.println("Cultists: Please accept our lord Xolgroth's blessing");
                            newBlessings[newBlessings.length - 1] = "Disciple of Xolgroth";
                            player.setBlessings(newBlessings);
                            player.setMaxHealth((int) (player.getMaxHealth() * 0.8));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            player.setPowerMax(player.getPowerMax() + 15);
                            player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * .1));
                            player.setAttackMax(player.getAttackMax() + (int) (player.getAttackMax() * .1));
                            variables.setXolgrothBlessing(true);
                            System.out.println("You have gained the blessing of Xolgroth!");
                            System.out.println("Your max health has been reduced by 20%\n"
                            + "Your max power has been increased by 15\n"
                            + "Your attack min has been increased by 10%\n"
                            + "Your attack max has been increased by 10%\n");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        }
                    } else {
                        System.out.println("Cultists: YOU LIE, YOU KNOW NOTHING OF LORD XOLGROTH!");
                        System.out.println("The cultists assualt you in a blinding rage.\n"
                        + "You take " + player.getHealth() / 2 + " damage!\n"
                        + "And the cultists have cursed you, your maximum health has been reduced by 20!");

                        player.setHealth(player.getHealth() / 2);
                        player.setMaxHealth(player.getMaxHealth() - 20);
                        if (player.getMaxHealth() < 1) {
                            player.setMaxHealth(1);
                        }

                        System.out.println("1. Continue");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        App.actionMenu();
                    }
                case 2:
                    System.out.println("How many siblings does Xolgroth have?");
                    System.out.println("1. One\n"
                    + "2. Two\n"
                    + "3. Four\n"
                    + "4. Seven-teen");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    if (choice == 2) {
                        System.out.println("Cultists: You do know lord Xolgroth...\n" +
                        "Cultists: Please forgive our intrusion!");
                        if (variables.getXolgrothBlessing() == true) {
                            System.out.println("Cultists: Please accept this gift for our insolence.");
                            player.setSkillPoints(player.getSkillPoints() + 1);
                            System.out.println("You have gained and 3 stat points!");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        } else if (variables.getXolgrothBlessing() == false) {
                            System.out.println("Cultists: Please accept our lord Xolgroth's blessing");
                            newBlessings[newBlessings.length - 1] = "Disciple of Xolgroth";
                            player.setBlessings(newBlessings);
                            player.setMaxHealth((int) (player.getMaxHealth() * 0.8));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            player.setPowerMax(player.getPowerMax() + 15);
                            player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * .1));
                            player.setAttackMax(player.getAttackMax() + (int) (player.getAttackMax() * .1));
                            variables.setXolgrothBlessing(true);
                            System.out.println("You have gained the blessing of Xolgroth!");
                            System.out.println("Your max health has been reduced by 20%\n"
                            + "Your max power has been increased by 15\n"
                            + "Your attack min has been increased by 10%\n"
                            + "Your attack max has been increased by 10%\n");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        }
                    } else {
                        System.out.println("Cultists: YOU LIE, YOU KNOW NOTHING OF LORD XOLGROTH!");
                        System.out.println("The cultists assualt you in a blinding rage.\n"
                        + "You take " + player.getHealth() / 2 + " damage!"
                        + "And the cultists have cursed you, your maximum health has been reduced by 20!");

                        player.setHealth(player.getHealth() / 2);
                        player.setMaxHealth(player.getMaxHealth() - 20);

                        System.out.println("1. Continue");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        App.actionMenu();
                    }
                case 3:
                    System.out.println("Who is Xolgroth's father?");
                    System.out.println("1. Astaroth\n"
                    + "2. Hades\n"
                    + "3. Nue\n"
                    + "4. Golgoroth");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    if (choice == 3) {
                       System.out.println("Cultists: You do know lord Xolgroth...\n" +
                        "Cultists: Please forgive our intrusion!");
                        if (variables.getXolgrothBlessing() == true) {
                            System.out.println("Cultists: Please accept this gift for our insolence.");
                            player.setSkillPoints(player.getSkillPoints() + 1);
                            System.out.println("You have gained and 3 stat points!");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        } else if (variables.getXolgrothBlessing() == false) {
                            System.out.println("Cultists: Please accept our lord Xolgroth's blessing");
                            newBlessings[newBlessings.length - 1] = "Disciple of Xolgroth";
                            player.setBlessings(newBlessings);
                            player.setMaxHealth((int) (player.getMaxHealth() * 0.8));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            player.setPowerMax(player.getPowerMax() + 15);
                            player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * .1));
                            player.setAttackMax(player.getAttackMax() + (int) (player.getAttackMax() * .1));
                            variables.setXolgrothBlessing(true);
                            System.out.println("You have gained the blessing of Xolgroth!");
                            System.out.println("Your max health has been reduced by 20%\n"
                            + "Your max power has been increased by 15\n"
                            + "Your attack min has been increased by 10%\n"
                            + "Your attack max has been increased by 10%\n");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        }
                    } else {
                        System.out.println("Cultists: YOU LIE, YOU KNOW NOTHING OF LORD XOLGROTH!");
                        System.out.println("The cultists assualt you in a blinding rage.\n"
                        + "You take " + player.getHealth() / 2 + " damage!"
                        + "And the cultists have cursed you, your maximum health has been reduced by 20!");

                        player.setHealth(player.getHealth() / 2);
                        player.setMaxHealth(player.getMaxHealth() - 20);

                        System.out.println("1. Continue");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        App.actionMenu();
                    }
                case 4:
                    System.out.println("Who imprisoned Xolgroth?");
                    System.out.println("1. The Gods\n"
                    + "2. The Demons\n"
                    + "3. The Humans\n"
                    + "4. The Elves");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    if (choice == 4) {
                       System.out.println("Cultists: You do know lord Xolgroth...\n" +
                        "Cultists: Please forgive our intrusion!");
                        if (variables.getXolgrothBlessing() == true) {
                            System.out.println("Cultists: Please accept this gift for our insolence.");
                            player.setSkillPoints(player.getSkillPoints() + 1);
                            System.out.println("You have gained and 3 stat points!");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        } else if (variables.getXolgrothBlessing() == false) {
                            System.out.println("Cultists: Please accept our lord Xolgroth's blessing");
                            newBlessings[newBlessings.length - 1] = "Disciple of Xolgroth";
                            player.setBlessings(newBlessings);
                            player.setMaxHealth((int) (player.getMaxHealth() * 0.8));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            player.setPowerMax(player.getPowerMax() + 15);
                            player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * .1));
                            player.setAttackMax(player.getAttackMax() + (int) (player.getAttackMax() * .1));
                            variables.setXolgrothBlessing(true);
                            System.out.println("You have gained the blessing of Xolgroth!");
                            System.out.println("Your max health has been reduced by 20%\n"
                            + "Your max power has been increased by 15\n"
                            + "Your attack min has been increased by 10%\n"
                            + "Your attack max has been increased by 10%\n");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        }
                    } else {
                        System.out.println("Cultists: YOU LIE, YOU KNOW NOTHING OF LORD XOLGROTH!");
                        System.out.println("The cultists assualt you in a blinding rage.\n"
                        + "You take " + player.getHealth() / 2 + " damage!"
                        + "And the cultists have cursed you, your maximum health has been reduced by 20!");

                        player.setHealth(player.getHealth() / 2);
                        player.setMaxHealth(player.getMaxHealth() - 20);

                        System.out.println("1. Continue");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        App.actionMenu();
                    }
                case 5:
                    System.out.println("What kind of demon is Xolgroth?");
                    System.out.println("1. A Infernal Demon\n"
                    + "2. An Arch Demon\n"
                    + "3. The Demon King\n"
                    + "4. A Lesser Demon");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    if (choice == 2) {
                        System.out.println("Cultists: You do know lord Xolgroth...\n" +
                        "Cultists: Please forgive our intrusion!");
                        if (variables.getXolgrothBlessing() == true) {
                            System.out.println("Cultists: Please accept this gift for our insolence.");
                            player.setStatPoints(player.getStatPoints() + 3);
                            System.out.println("You have gained 3 stats points!");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        } else if (variables.getXolgrothBlessing() == false) {
                            System.out.println("Cultists: Please accept our lord Xolgroth's blessing");
                            newBlessings[newBlessings.length - 1] = "Disciple of Xolgroth";
                            player.setBlessings(newBlessings);
                            player.setMaxHealth((int) (player.getMaxHealth() * 0.8));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            player.setPowerMax(player.getPowerMax() + 15);
                            player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * .1));
                            player.setAttackMax(player.getAttackMax() + (int) (player.getAttackMax() * .1));
                            variables.setXolgrothBlessing(true);
                            System.out.println("You have gained the blessing of Xolgroth!");
                            System.out.println("Your max health has been reduced by 20%\n"
                            + "Your max power has been increased by 15\n"
                            + "Your attack min has been increased by 10%\n"
                            + "Your attack max has been increased by 10%\n");
                            System.out.println("1. Continue");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            App.actionMenu();
                        }
                    } else {
                        System.out.println("Cultists: YOU LIE, YOU KNOW NOTHING OF LORD XOLGROTH!");
                        System.out.println("The cultists assualt you in a blinding rage.\n"
                        + "You take " + player.getHealth() / 2 + " damage!\n"
                        + "And the cultists have cursed you, your maximum health has been reduced by 20!");

                        player.setHealth(player.getHealth() / 2);
                        player.setMaxHealth(player.getMaxHealth() - 20);

                        System.out.println("1. Continue");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        App.actionMenu();
                    }
            }
        } else if (choice == 2) {
            travel.setDiciplesOfXolgroth(true);
            enemyGeneration.generateEnemy("Diciples of Xolgroth");
            scanner.close();
        }
    }

    public void witch() {
        Scanner scanner = new Scanner(System.in);
        Player player = App.getPlayer();
        ClassType classType =App.getClassType();
        Inventory inventory = App.getInventory();
        Boolean travelerRoute = false;
        int choice = 0;
        int conversation = 0;

        System.out.println("You approach the shack and knock on the door.");
        System.out.println("Voice: Come in!\n" + "You enter the shack.");
        System.out.println("Inside you meet a witch.");
        System.out.println("Witch: Hello there traveler, those who know of me call me the swamp witch.\n");

        System.out.println("1. Greetings Swamp Witch, I am " + player.getName());
        System.out.println("2. Nice to make your acquaintance, I am " + player.getName());
        System.out.println("3. Ignore the witch and look around the shack.");
        if (classType.getDangerSenseUnlocked() == true && classType.getDangerSenseUpgrade() >= 5) {
            System.out.println("Your Danger Sense is urging you to pick option 2!");
        }

        try {
            choice = scanner.nextInt();
            App.clearScreen();
        } catch (InputMismatchException e) {
            scanner.next(); // clear the scanner buffer
            App.clearScreen();
            witch();
        }

        switch (choice) {
            case 1:
                System.out.println("Witch: What brings you out this far off the path?");
                System.out.println("1. I was just exploring.");
                System.out.println("2. I was looking for you.");

                choice = scanner.nextInt();
                App.clearScreen();
                break;
            case 2:
                conversation++;
                System.out.println("Witch: It's nice to meet you " + player.getName() + ".");
                System.out.println("Witch: What brings you out this far off the path?\n");
                System.out.println("1. I was just exploring.");
                System.out.println("2. I was looking for you.");

                choice = scanner.nextInt();
                App.clearScreen();
                break;
            case 3:
                System.out.println("Don't ignore me, I'm talking to you!");
                System.out.println("The witch curses you, your max health has been reduced by 5%!");
                player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 20));
                if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                System.out.println("1. I'm sorry");

                scanner.next();
                App.clearScreen();

                System.out.println("Witch: What brings you out this far off the path anyway?");
                System.out.println("1. I was just exploring.");
                System.out.println("2. I was looking for you.");

                choice = scanner.nextInt();
                App.clearScreen();
                break;
        }

        switch (choice) {
            case 1:
                travelerRoute = true;
                System.out.println("Witch: Ah, I see. Here I put a pot of tea on, would you like some?");
                System.out.println("1. Yes please");
                System.out.println("2. Thanks, but I'm a bit awash at the moment");
                System.out.println("3. No thank you");

                choice = scanner.nextInt();
                App.clearScreen();
                break;
            case 2:
                System.out.println("The witch looks uneasy.");
                break;
        }

        if (travelerRoute == true) {
            switch (choice) {
                case 1:
                    conversation++;
                    System.out.println("The witch snaps her fingers and a cup of tea appears infront of you.");
                    System.out.println("Witch: there you are, drink up.");
                    System.out.println("1. Thank you");
                    scanner.next();
                    App.clearScreen();
                    break;
                case 2:
                    System.out.println("Witch: Very well then.");
                    System.out.println("The witch snaps her fingers and a cup of tea appears in her hands.");
                    System.out.println("She takes a sip and smiles.");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();

                case 3:
                    System.out.println("Witch: Suit yourself.");
                    System.out.println("The witch snaps her fingers and a cup of tea appears in her hands.");
                    System.out.println("She takes a sip and smiles.");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
            }
        }

        System.out.println("Witch: So what can I do for you?");
        System.out.println("1. I was hoping you could teach me some magic");
        System.out.println("2. I heard you have some rare magical materials");

        choice = scanner.nextInt();
        App.clearScreen();

        switch (choice) {
            case 1:
                conversation++;
                System.out.println("Witch: Ohhh no, I don't teach anymore.");
                System.out.println("Witch: I'm sorry, but I've closed that chapter of my life.");
                System.out.println("1. I understand");
                System.out.println("2. Please, I need to get stronger!");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) { break; }
                else if (choice == 2) {
                    System.out.println("Witch: I said no!");
                    System.out.println("The witch curses you, your max health has been reduced by 5%!");
                    player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 20));
                    if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                    System.out.println("1. Forgive me");
                    scanner.next();
                    App.clearScreen();
                }
                break;
            case 2:
                System.out.println("Witch: I do, but I don't just give them away.");
                System.out.println("Witch: I'll trade you for them. Here's what I have to offer:");
                System.out.println("1. 1x Wild Root for 5x Bear Tooth");
                System.out.println("2. 1x Medusa's Snake Scale for 3x Demon Wing");
                System.out.println("3. 1x Sweet Serendipity for 1x Salruth's Horn");
                System.out.println("4. Nevermind");

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        if (inventory.getMaterialAmount("Bear Tooth") >= 5) {
                            System.out.println("Witch: Ah, you have the materials I need.");
                            System.out.println("Witch: Here is your One Wild Root.");
                            inventory.addMaterialToInventory("Wild Root", 1);
                            inventory.removeMaterialFromInventory("Bear Tooth", 5);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                        } else {
                            System.out.println("Witch: You don't have the materials I need.");
                            System.out.println("Witch: How dare you waste my time!");
                            System.out.println("The witch curses you, your max health has been reduced by 5%!");
                            player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 20));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            System.out.println("1. Many apologies");
                            scanner.next();
                            App.clearScreen();
                        }
                        break;
                    case 2:
                        if (inventory.getMaterialAmount("Demon Wing") >= 3) {
                            System.out.println("Witch: Ah, you have the materials I need.");
                            System.out.println("Witch: Here is your One Medusa's Snake Scale.");
                            inventory.addMaterialToInventory("Medusa's Snake Scale", 1);
                            inventory.removeMaterialFromInventory("Demon Wing", 3);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                        } else {
                            System.out.println("Witch: You don't have the materials I need.");
                            System.out.println("Witch: How dare you waste my time!");
                            System.out.println("The witch curses you, your max health has been reduced by 5%!");
                            player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 20));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            System.out.println("1. Many apologies");
                            scanner.next();
                            App.clearScreen();
                        }
                        break;
                    case 3:
                        if (inventory.getMaterialAmount("Salruth's Horn") >= 1) {
                            System.out.println("Witch: Ah, you have the materials I need.");
                            System.out.println("Witch: Here is your One Sweet Serendipity.");
                            inventory.addMaterialToInventory("Sweet Serendipity", 1);
                            inventory.removeMaterialFromInventory("Salruth's Horn", 1);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                        } else {
                            System.out.println("Witch: You don't have the materials I need.");
                            System.out.println("Witch: How dare you waste my time!");
                            System.out.println("The witch curses you, your max health has been reduced by 5%!");
                            player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 20));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            System.out.println("1. Many apologies");
                            scanner.next();
                            App.clearScreen();
                        }
                        break;
                    case 4:
                        System.out.println("Witch: Very well then.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        break;
                }
                break;

        }

        System.out.println("Witch: Well, I'm afraid I must get going, you can see yourself out.");
        System.out.println("1. Leave the shack");

        scanner.next();
        App.clearScreen();

        System.out.println("You leave the shack and continue on your journey. When suddenly a note appears in your pocket.");

        switch (conversation) {
            case 0:
                System.out.println("The note reads: You're not very good at talking to people are you?");
                break;
            case 1:
                System.out.println("The note reads: I enjoyed our conversation, come back and visit me sometime.");
                System.out.println("You gain 1 Attribute Point!");
                player.setAttributePoints(player.getAttributePoints() + 1);
                break;
            case 2:
                System.out.println("The note reads: I enjoyed our conversation & your company, do visit again!");
                System.out.println("You gain 2 Attribute Point!");
                System.out.println("You also aquired 1 Witch's Favor!");
                inventory.addMaterialToInventory("Witch's Favor", 1);
                player.setAttributePoints(player.getAttributePoints() + 2);
                break;
            case 3:
                System.out.println("The note reads: I loved my time with you! I hope to see you again soon!");
                System.out.println("You gain 2 Attribute Point!");
                System.out.println("You gain 3 Stat Points!");
                System.out.println("You also aquired 2 Witch's Favor!");
                inventory.addMaterialToInventory("Witch's Favor", 2);
                player.setAttributePoints(player.getAttributePoints() + 3);
                player.setStatPoints(player.getStatPoints() + 2);
                break;
        }

        System.out.println("1. Continue");
        scanner.next();
        App.clearScreen();
        App.actionMenu();
        scanner.close();
    }

    public void zolgadiyun() {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Inventory inventory = App.getInventory();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        int choice = 0;
        Boolean xolgroth = false;
        Boolean salruth = false;
        Boolean zolgadiyun = false;


        for (int i = 0; i < player.getBlessings().length; i++) {
            if (player.getBlessings()[i].equals("Disciple of Xolgroth")) {
                xolgroth = true;
            } else if (player.getBlessings()[i].equals("Salruth's Acolyte")) {
                salruth = true;
            } else if (player.getBlessings()[i].equals("Zolgadiyun's Champion")) {
                zolgadiyun = true;
            }
        }

        System.out.println("You travel through the volcano and witness a ritual taking place.");
        System.out.println("Suddenly the ritual seems to go wrong and a massive demon appears!\n");
        System.out.println("Demon: MORTALS! WHY HAVE YOU DISTURBED MY SLUMBER!?");
        System.out.println("Ritual leader: We were trying to summon you great Zolgadiyun!");
        System.out.println("Zolgadiyun: FOR WHAT MORTAL?!");
        System.out.println("Ritual leader: We were hoping you could grant-\n");
        System.out.println("And in that moment, the leader was eviscerated by the demon.");
        System.out.println("Zolgadiyun: I DO NOT SERVE ANY MORTAL, IS THAT CLEAR?");
        System.out.println("Zolgadiyun: I AM PRINCE OF THE UNDERWORLD, I AM ZOLGADIYUN!\n");
        System.out.println("The demon continues on and on about how strong he is etc...");
        System.out.println("1. Nah I'd Solo (Fight)");
        if (zolgadiyun == false) {
            if (xolgroth == true && salruth == false) { System.out.println("2. I have been blessed by your brother Xolgroth, I am not afraid of you!"); }
            else if (xolgroth == false && salruth == true) { System.out.println("2. I carry your sister's blessing, I am not afraid of you!"); }
            else if (xolgroth == true && salruth == true) { System.out.println("2. I have been blessed by both of your siblings, I am loyal to your family."); }
            else if (xolgroth == false && salruth == false) { System.out.println("2. Who are you?"); }
        } else if (zolgadiyun == true) {
            System.out.println("2. Can you help me become a demon?");
        }
        System.out.println("3. Walk away");

        choice = scanner.nextInt();
        App.clearScreen();

        switch (choice) {
            case 1:
                enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                break;
            case 2:
                if (zolgadiyun == false) {
                    if (xolgroth == true && salruth == false) {
                        System.out.println("Zolgadiyun: Ehh, everyone is blessed by Xolgroth!");
                        System.out.println("Zolgadiyun: Xolgroth is the runt of the litter, he is nothing.");
                        System.out.println("Zolgadiyun: But I will spare you, you may leave now... and only now.");
                        System.out.println("1. Leave");
                        System.out.println("2. I'm stronger than you think! (Fight)");

                        choice = scanner.nextInt();
                        App.clearScreen();

                        if (choice == 1) {
                            App.actionMenu();
                        } else if (choice == 2) {
                            enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                        }
                        break;
                    } else if (xolgroth == false && salruth == true) {
                        System.out.println("Zolgadiyun: Oh, Salruth blessed you?");
                        System.out.println("Zolgadiyun: You must be sharper than the average tool...");
                        System.out.println("Zolgadiyun: I Zolgadiyun, Prince of the Underworld recognize you.");
                        System.out.println("Zolgadiyun: Here, let these aid you on your journey mortal.");
                        inventory.addMaterialToInventory("Demon Wing", 2);
                        inventory.addMaterialToInventory("Obsidian", 1);
                        System.out.println("You have gained 2 Demon Wings & 1 Obsidian!");
                        System.out.println("1. Thank you Zolgadiyun");
                        System.out.println("2. Attempt to Assassinate Zolgadiyun");

                        choice = scanner.nextInt();
                        App.clearScreen();

                        if (choice == 1) {
                            App.actionMenu();
                        } else if (choice == 2) {
                            int atempt = random.nextInt(100);
                            if (atempt == 50) {
                                System.out.println("You attempt to assassinate Zolgadiyun, and you succeed!");
                                System.out.println("Zolgadiyun: AGHHAHGHGHHHHAHG!!");
                                // Loot
                                inventory.addMaterialToInventory("Demon Wing", 2);
                                inventory.addMaterialToInventory("Obsidian", 10);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("You attempt to assassinate Zolgadiyun, but he is too strong!");
                                System.out.println("Zolgadiyun: YOU WILL PAY FOR YOUR INSOLENCE!");
                                System.out.println("1. Fight");
                                scanner.next();
                                App.clearScreen();
                                enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                                break;
                            }
                        }
                    } else if (xolgroth == true && salruth == true) {
                        System.out.println("Zolgadiyun: Hmmm, both Xolgroth and Salruth blessed you?");
                        System.out.println("Zolgadiyun: You very well may be loyal to us...");
                        System.out.println("Zolgadiyun: Slay these pitiful mortals and I will grant you the chance at something unrivaled.");
                        System.out.println("1. Fight the cultists");
                        System.out.println("2. I will not kill these people");

                        choice = scanner.nextInt();
                        App.clearScreen();

                        if (choice == 1) {
                            enemyGeneration.generateEnemy("Annoying Cultists");
                        }
                        else if (choice == 2){
                            System.out.println("Zolgadiyun: You refuse?");
                            System.out.println("Zolgadiyun: Very well then, leave us then.");
                            System.out.println("Zolgadiyun: But know I am disappointed mortal.");
                            System.out.println("1. Leave");
                            System.out.println("2. ...But I will kill you! (Fight)");

                            choice = scanner.nextInt();
                            App.clearScreen();

                            if (choice == 1) {
                                App.actionMenu();
                            } else if (choice == 2) {
                                enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                            }
                            break;
                        }
                    } else if (xolgroth == false && salruth == false) {
                        String name = "";
                        System.out.println("Zolgadiyun: You do not know who I am?");
                        System.out.println("Zolgadiyun: I am Zolgadiyun, Prince of the Underworld!");
                        System.out.println("Zolgadiyun: I will spare you if you can answer this one question.");
                        System.out.println("Zolgadiyun: What is one of my sibling's name?");
                        System.out.println("1. I won't play your games demon! (Fight)");
                        System.out.println("2. Answer the question");

                        choice = scanner.nextInt();
                        App.clearScreen();

                        if (choice == 1) {
                            enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                        } else if (choice == 2) {
                            System.out.print("Enter the name of one of Zolgadiyun's siblings: ");
                            name = scanner.next();
                            App.clearScreen();
                            if (name.equals("Xolgroth") || name.equals("xolgroth") || name.equals("Salruth") || name.equals("salruth")) {
                                System.out.println("Zolgadiyun: Well done, you may leave now.");
                                System.out.println("1. Leave");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        }
                    }
                    break;
                } else if (zolgadiyun == true) {
                    System.out.println("Zolgadiyun: Oh I can't help you any more than I already have.");
                    System.out.println("Zolgadiyun: You must seek out my father, Nue.");
                    System.out.println("Zolgadiyun: Here, take this and good luck.");
                    inventory.addMaterialToInventory("Demon Heart", 1);
                    System.out.println("You have gained 1 Demon Heart!");
                    System.out.println("1. Thank you Zolgadiyun");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                }
            case 3:
                int flee = 0;
                switch (App.getSettings().getDifficulty()) {
                    case 1:
                        flee = random.nextInt(2) + 1;
                        if (flee == 1) {
                            App.clearScreen();
                            App.actionMenu();
                        } else {
                            System.out.println("Zolgadiyun: You will not escape me!");
                            System.out.println("1. Fight");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                        }
                    case 2:
                        flee = random.nextInt(4) + 1;
                        if (flee == 1) {
                            App.clearScreen();
                            App.actionMenu();
                        } else {
                            System.out.println("Zolgadiyun: You will not escape me!");
                            System.out.println("1. Fight");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                        }
                    case 3:
                        flee = random.nextInt(6) + 1;
                        if (flee == 1) {
                            App.clearScreen();
                            App.actionMenu();
                        } else {
                            System.out.println("Zolgadiyun: You will not escape me!");
                            System.out.println("1. Fight");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Prince of The Underworld, Zolgadiyun");
                        }
                }
        }
    }

    public void zolgadiyunCont() {
        Scanner scanner = new Scanner(System.in);
        Inventory inventory = App.getInventory();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        int choice = 0;

        System.out.println("Zolgadiyun: Ahh, the delicious smell of blood.");
        System.out.println("Zolgadiyun: I see you have slain my cultists, well done.");
        System.out.println("Zolgadiyun: As promised, here's your reward.");
        inventory.addMaterialToInventory("Dark Essentia", 1);
        System.out.println("You have gained 1 Dark Essentia!\n");
        System.out.println("Zolgadiyun: Now I have one more task for you.");
        System.out.println("Zolgadiyun: I need you to slay my brother Xolgroth.");
        System.out.println("Zolgadiyun: He is weak and pathetic, he is no match for you.");
        System.out.println("Zolgadiyun: Defeat him and I will grant you my blessing." 
        + "Zolgadiyun: With all three blessings you can petition my father for demonic powers.");
        System.out.println("1. I will end Xolgroth");
        System.out.println("2. I will not slay Xolgroth");
        System.out.println("3. Why do you want me to kill your brother?");

        choice = scanner.nextInt();
        App.clearScreen();

        switch (choice) {
            case 1:
                System.out.println("Zolgadiyun: Great! I knew you would help me.");
                System.out.println("Zolgadiyun: I'll send you to him now.");
                System.out.println("1. Fight");
                scanner.next();
                App.clearScreen();
                enemyGeneration.generateEnemy("Xolgroth");
            case 2:
                System.out.println("Zolgadiyun: Sigh, mortals and their morals.");
                System.out.println("Zolgadiyun: Goodbye then");
                System.out.println("Zolgradiyun snaps his fingers and before you can blink you are back on the path.");
                System.out.println("1. Continue");
                scanner.next();
                App.clearScreen();
                App.actionMenu();
            case 3:
                System.out.println("Zolgadiyun: With Xolgroth out of the way, I'll take control of his territory.");
                System.out.println("Zolgadiyun: I'll becopme the most influential demon aside from my father.");
                System.out.println("Zolgadiyun: I'll be able to do whatever I want then!");
                System.out.println("Zolgadiyun: So what do you say? Will you help me?\n");
                System.out.println("1. I'll do it");
                System.out.println("2. Nah I'm good");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    System.out.println("Zolgadiyun: Great! I knew you would help me.");
                    System.out.println("Zolgadiyun: I'll send you to him now.");
                    System.out.println("1. Fight");
                    scanner.next();
                    App.clearScreen();
                    enemyGeneration.generateEnemy("Xolgroth");
                } else if (choice == 2) {
                    System.out.println("Zolgadiyun: Sigh, mortals and their morals.");
                    System.out.println("Zolgadiyun: Goodbye then");
                    System.out.println("Zolgadiyun snaps his fingers and before you can blink you are back on the path.");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                }
        }

    }

    public void zolgadiyunPartThree() {
        Scanner scanner = new Scanner(System.in);
        Player player = App.getPlayer();
        
        System.out.println("Zolgadiyun: YES! YOU DID IT!");
        System.out.println("Zolgadiyun: I MUST GET TO WORK NOW, BUT THIS WILL NOT BE FORGOTTEN!");
        System.out.println("Zolgadiyun: I GRANT THEE MY BLESSING!");
        System.out.println("Zolgadiyun: IF YOU PETITION MY FATHER I WILL BACK YOU!");
        System.out.println("Zolgadiyun: OKAY, I MUST GO NOW!\n");

        System.out.println("Zolgadiyun disappears in a cloud of smoke.");
        System.out.println("You feel a surge of power, you have gained Zolgadiyun's blessing!");
        System.out.println("Your max health has been increased by 20%\n"
        + "Your max power has been increased by 20\n"
        + "Your attack min has been increased by 5%\n"
        + "Your defense has been increased by 10%\n");
                
        String[] newBlessings = Arrays.copyOf(player.getBlessings(), player.getBlessings().length + 1);
        newBlessings[newBlessings.length - 1] = "Zolgadiyun's Champion";
        player.setBlessings(newBlessings);

        player.setMaxHealth((int) (player.getMaxHealth() * 1.2));
        if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
        player.setPowerMax(player.getPowerMax() + 20);
        player.setAttackMin(player.getAttackMin() + (int) (player.getAttackMin() * .05));
        player.setDefense(player.getDefense() + (int) (player.getDefense() * .1));

        System.out.println("1. Continue");
        scanner.next();
        App.clearScreen();
        App.actionMenu();
    }

    public void frozenElf() {
        Player player = App.getPlayer();
        Scanner scanner = new Scanner(System.in);
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();

        System.out.println("You take the elf to the Inn.");
        System.out.println("You get a room for the elf and lay her down on the bed.");
        System.out.println("You ask the Inkeeper to bring you some warm wate, cloth, and as many blankets as he can spare.");
        System.out.println("You wet the cloth and place it on the elf's forehead.");
        System.out.println("You wrap the elf in the blankets and take a seat across the room.\n");
        System.out.println("1. Wait...");

        scanner.next();
        App.clearScreen();

        System.out.println("You wait for a few hours, and the elf begins to stir.");
        System.out.println("Elf: Where am I?\n");

        System.out.println("1. You're at an Inn, I found you frozen in the mountains.");

        scanner.next();
        App.clearScreen();

        System.out.println("Elf: Oh... Thank you for saving me.");
        System.out.println("The elf looks uneasy.");
        System.out.println("Elf: I'm sorry, I don't know how to repay you.\n");
        System.out.println("1. You don't need to repay me, I'm just glad you're okay.");

        scanner.next();
        App.clearScreen();

        System.out.println("Amelia: Oh okay, my name is Amelia.");
        System.out.println("Amelia: I'm a Missionary from the temple of the gods");

        for (int i = 0; i < player.getBlessings().length; i++) {
            if (player.getBlessings()[i].equals("Physique")
                || player.getBlessings()[i].equals("Character")
                || player.getBlessings()[i].equals("Fortitude")
                || player.getBlessings()[i].equals("Intuition")
                || player.getBlessings()[i].equals("Skillfulness")
                || player.getBlessings()[i].equals("The Prodigy")
            ) {
                System.out.println("Amelia: Oh, it seems you have been blessed by the gods as well.");
                System.out.println("Amelia: I'm glad it was you who found me.");
                break;
            }
        }

        System.out.println("Amelia: I was just begining my journey to establish a new church, but a avalanche hit.");
        System.out.println("Amelia: I was knocked off the path, and trapped under the snow.");
        System.out.println("Amelia: I was sure I was going to die, but you saved me-\n");
        System.out.println("The elf begins to go into a coughing fit.");
        System.out.println("Amelia: I'm sorry, I'm still a bit weak, I need to rest.");
        System.out.println("Amelia: What is your name my savior?\n");

        System.out.println("1. I'm " + player.getName());

        scanner.next();
        App.clearScreen();

        System.out.println("Amelia: Well met " + player.getName() + ", i'm going to rest now.");
        System.out.println("Amelia: We will meet again soon, I promise.");
        System.out.println("Amelia: Take this, and be on your way. The gods will put us on the same path again.\n");

        System.out.println("You have aquired 1 Astra Coin!");
        inventory.addMaterialToInventory("Astra Coin", 1);
        variables.setAmelia(true);

        System.out.println("1. Continue");
        scanner.next();
        App.clearScreen();
        App.actionMenu();
    }

    public void templeOfTheGods() {
        Player player = App.getPlayer();
        Scanner scanner = new Scanner(System.in);
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        int choice = 0;

        System.out.println("You travel through the mountains untill you reach a long staircase.");
        System.out.println("You climb the stairs, one by one, until you reach the top.");
        System.out.println("You are near the top of the mountain, and you can see a temple in the distance.");
        System.out.println("You continue on and reach the temple.\n");

        System.out.println("You're greeted by a few guardian monks.");
        System.out.println("Guardian: Welcome to the temple of the gods, don't cause any trouble.");
        System.out.println("Guardian: If you need anything, just ask.");

        System.out.println("1. Enter the temple");
        System.out.println("2. Turn around and leave");

        choice = scanner.nextInt();
        App.clearScreen();

        if (choice == 2) {
            App.clearScreen();
            App.actionMenu();
        } 

        System.out.println("You enter the temple and are greeted by a monk.");
        System.out.println("Monk: Welcome to the temple of the gods, I am Brother Talo.");
        System.out.println("Talo: What brings you to the temple?\n");

        System.out.println("1. I heard there is a divine merchant here.");

        if (variables.getTsungBlessing() == true && variables.getTempleTsung() == false) {
            System.out.println("2. I was hoping to meet with Tsung.");
        }

        if (variables.getAmelia() == true && variables.getAmeliaReward() == false) {
            System.out.println("3. I found a missionary named Amelia frozen in the mountains, she said she was from here.");
        }

        choice = scanner.nextInt();
        App.clearScreen();

        switch (choice) {
            case 1:
                System.out.println("Talo: Ah yes, come with me.");
                System.out.println("Talo leads you to a monk who is sitting on a table.");
                System.out.println("Talo: This is Brother Kale, he is the divine merchant.");
                System.out.println("Kale: Hello, what can I do for you?\n");

                System.out.println("1. I would like to buy something");
                System.out.println("2. Nevermind");

                choice = scanner.nextInt();
                App.clearScreen();
                
                if (choice == 2) {
                    App.clearScreen();
                    App.actionMenu();
                } else if (choice == 1) {
                    System.out.println("Kale: Here are my wares:");
                    System.out.println("0. Leave");
                    System.out.println("1. 20x Cursed Finger for Divine Wheel of Harmony");
                    System.out.println("2. 1x Astra Coin for Divine Wheel of Harmony");
                    System.out.println("3. 1x Sweet Serendipity for Durandal");
                    System.out.println("4. 1x Astra Coin for Durandal");
                    System.out.println("5. 10x Witch's Favor for 1x Perfect Ring");
                    System.out.println("6. 2x Pure Arcenergy for 1x Vial of Arcenergy");
                    System.out.println("7. 5x Demon Heart for 1x Dark Essentia");

                    choice = scanner.nextInt();
                    App.clearScreen();

                    switch (choice) {
                        case 0:
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        case 1:
                            if (variables.getArtifacts() == true) {
                                if (inventory.getMaterialAmount("Cursed Finger") == 20) {
                                    System.out.println("Kale: Ah, you have the materials I need.");
                                    System.out.println("Kale: Here is your Divine Wheel of Harmony.");
                                    inventory.removeMaterialFromInventory("Cursed Finger", 20);
                                    Generation.createRing("Divine Wheel of Harmony", false);
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                } else {
                                    System.out.println("Kale: You don't have the materials I need.");
                                    System.out.println("1. Many apologies");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                }
                                break;
                            } else {
                                System.out.println("Kale: You must be level 30+ to buy this!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        case 2:
                            if (variables.getArtifacts() == true) {
                                if (inventory.getMaterialAmount("Astra Coin") >= 1) {
                                    System.out.println("Kale: Ah, you have the materials I need.");
                                    System.out.println("Kale: Here is your Divine Wheel of Harmony.");
                                    inventory.removeMaterialFromInventory("Astra Coin", 1);
                                    Generation.createRing("Divine Wheel of Harmony", false);
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                } else {
                                    System.out.println("Kale: You don't have the materials I need.");
                                    System.out.println("1. Many apologies");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                }
                                break;
                            } else {
                                System.out.println("Kale: You must be level 30+ to buy this!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        case 3:
                            if (variables.getArtifacts() == true) {
                                if (inventory.getMaterialAmount("Sweet Serendipity") >= 1) {
                                    System.out.println("Kale: Ah, you have the materials I need.");
                                    System.out.println("Kale: Here is your Durandal.");
                                    inventory.removeMaterialFromInventory("Sweet Serendipity", 1);
                                    Weapon weapon = new Weapon("Durandal", "Sword", "Artifactium", player.getLevel(), 140000, true, false);
                                    Generation.filterLoot(weapon);
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                } else {
                                    System.out.println("Kale: You don't have the materials I need.");
                                    System.out.println("1. Many apologies");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                }
                                break;
                            } else {
                                System.out.println("Kale: You must be level 30+ to buy this!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        case 4:
                            if (variables.getArtifacts() == true) {
                                if (inventory.getMaterialAmount("Astra Coin") >= 1) {
                                    System.out.println("Kale: Ah, you have the materials I need.");
                                    System.out.println("Kale: Here is your Durandal.");
                                    inventory.removeMaterialFromInventory("Astra Coin", 1);
                                    Weapon weapon = new Weapon("Durandal", "Sword", "Artifactium", player.getLevel(), 140000, true, false);
                                    Generation.filterLoot(weapon);
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                } else {
                                    System.out.println("Kale: You don't have the materials I need.");
                                    System.out.println("1. Many apologies");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                }
                                break;
                            } else {
                                System.out.println("Kale: You must be level 30+ to buy this!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        case 5:
                            if (inventory.getMaterialAmount("Witch's Favor") >= 10) {
                                System.out.println("Kale: Ah, you have the materials I need.");
                                System.out.println("Kale: Here is your Perfect Ring.");
                                inventory.removeMaterialFromInventory("Witch's Favor", 10);
                                Generation.createRing("null", true);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            } else {
                                System.out.println("Kale: You don't have the materials I need.");
                                System.out.println("1. Many apologies");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                            break;
                        case 6:
                            if (inventory.getMaterialAmount("Pure Arcenergy") >= 2) {
                                System.out.println("Kale: Ah, you have the materials I need.");
                                System.out.println("Kale: Here is your Vial of Arcenergy.");
                                inventory.removeMaterialFromInventory("Pure Arcenergy", 2);
                                inventory.addMaterialToInventory("Vial of Arcenergy", 1);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            } else {
                                System.out.println("Kale: You don't have the materials I need.");
                                System.out.println("1. Many apologies");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                            break;
                        case 7:
                            if (inventory.getMaterialAmount("Demon Heart") >= 5) {
                                System.out.println("Kale: Ah, you have the materials I need.");
                                System.out.println("Kale: Here is your Dark Essentia.");
                                inventory.removeMaterialFromInventory("Demon Heart", 5);
                                inventory.addMaterialToInventory("Dark Essentia", 1);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            } else {
                                System.out.println("Kale: You don't have the materials I need.");
                                System.out.println("1. Many apologies");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                            break;
                    }
                    break;
                }
                break;
            case 2:
                if (variables.getTsungBlessing() == true && variables.getTempleTsung() == false) {
                    System.out.println("Talo: Ah, you're the one brother Tsung spoke about?");
                    System.out.println("Talo: He will be happy to see you, I'll take you to him.\n");

                    System.out.println("You follow Talo to a room in the back of the temple.");
                    System.out.println("Talo: Brother Tsung, you have a visitor.");
                    System.out.println("Tsung: oooh, my traveler friend " + player.getName() + "!");
                    System.out.println("Tsung: I'm glad you made it, I have something for you.\n");

                    System.out.println("Tsung hands you a coin.");
                    System.out.println("Tsung: This is a gift from the gods, it will help you on your journey.\n");

                    System.out.println("You have aquired 1 Astra Coin!");
                    inventory.addMaterialToInventory("Astra Coin", 1);
                    variables.setTempleTsung(true);

                    System.out.println("Tsung: I'm sorry, but I must get back to my studies.");
                    System.out.println("Tsung: It was nice to see you again, I hope we meet again soon.");
                    System.out.println("Tsung: I'll show you out.\n");

                    System.out.println("You follow Tsung out of the temple.");
                    System.out.println("Tsung: I hope you find what you're looking for " + player.getName() + ".");
                    System.out.println("Tsung: I'll be praying for you.\n");

                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
                App.clearScreen();
                App.actionMenu();
                break;
            case 3:
                if (variables.getAmeliaReward() == false && variables.getAmelia() == true) {
                    System.out.println("Talo: You found Amelia?!");
                    System.out.println("Talo: Thank the gods, we have been worried sick about her.");
                    System.out.println("Talo: Come, the high priest will want to speak with you.\n");

                    System.out.println("You follow Talo to a grand room in the middle of the temple.");
                    System.out.println("Talo: I present High Priest Vothos, Envoy of The Astrals\n");

                    System.out.println("A unusually tall & old man stands up from his chair.");
                    System.out.println("Vothos: Welcome welcome, what brings you to our humble temple?");
                    System.out.println("Talo: This is the traveler who saved Amelia.");
                    System.out.println("Vothos: Shes alive?! Thank the gods!");
                    System.out.println("Vothos: You have my eternal gratitude " + player.getName() + ".");
                    System.out.println("Vothos: Take this, it's the least I can do to repay you.\n");

                    System.out.println("You have aquired 1 Astra Coin!");
                    inventory.addMaterialToInventory("Astra Coin", 1);

                    System.out.println("Vothos: Oh, and take these as well.\n");

                    System.out.println("You have aquired 1 Book of Gods!");
                    System.out.println("You have aquired 10 Holy Water");
                    inventory.addMaterialToInventory("Book of Gods", 1);
                    inventory.addMaterialToInventory("Holy Water", 10);

                    System.out.println("Vothos: Take this book to Amelia, she will know what to do with it.");
                    System.out.println("Vothos: I'm sorry, but I must get back to my duties.");
                    System.out.println("Vothos: You will always be welcome here " + player.getName() + ".");

                    System.out.println("1. Thank you High Priest Vothos");
                    variables.setAmeliaReward(true);
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
            break;
        }
    }

    public void dwarvenForge(Boolean traveled) {
        Player player = App.getPlayer();
        Scanner scanner = new Scanner(System.in);
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        int choice = 0;

        if (traveled == true) {
            System.out.println("You travel through the mountains untill you come across a dwarven forge.");
            System.out.println("You enter the forge and are greeted by the master blacksmith.");
            System.out.println("Hasun: Welcome to the only forge in the world that can smelt Mithril!");
            System.out.println("Hasun: What can I do for you?\n");
        }

        System.out.println("╔═════════════════════════════════╗");
        System.out.println("║          Dwarven Forge          ║");
        System.out.println("╠═════════════════════════════════╣");
        System.out.println("║                                 ║");
        System.out.println("║ 0. Leave                        ║");
        System.out.println("║ 1. Forge Mithril Ingots         ║");
        System.out.println("║ 2. Forge Mithril Armor          ║");
        System.out.println("║ 3. Forge Mithril Weapons        ║");
        if (variables.getDwarvenForge() == false) {
        System.out.println("║ 4. Ask about relocation         ║");}
        System.out.println("║                                 ║");
        System.out.println("╚═════════════════════════════════╝");
        System.out.print("Enter your choice: ");

        try {
            choice = scanner.nextInt();
            App.clearScreen();
        } catch (InputMismatchException e) {
            System.out.println("Invalid input, please try again.");
            App.clearScreen();
            dwarvenForge(traveled);
        }

        switch (choice) {
            case 0:
                App.clearScreen();
                if (traveled == false) {
                    Town.townMenu();
                } else {
                    App.actionMenu();
                }
                App.actionMenu();
                break;
            case 1:
                int ingots = 0;
                System.out.println("Hasun: Ah, you want to forge some Mithril Ingots?");
                System.out.println("Hasun: 3 Mithril Ore & 20 Coal makes 1 Mithril Ingot.");
                System.out.println("Hasun: How many Mithril Ingots would you like to forge?\n");

                ingots = scanner.nextInt();
                App.clearScreen();

                if (ingots <= 0) {
                    System.out.println("Hasun: You can't forge nothing!");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    if (traveled == false) {
                        dwarvenForge(traveled);
                    } else {
                        App.actionMenu();
                    }
                    break;
                }

                if (inventory.getMaterialAmount("Mithril Ore") >= (3 * ingots) && inventory.getMaterialAmount("Coal") >= (20 * ingots)) {
                    System.out.println("Hasun: Alright, I'll get to work...\n");
                    System.out.println("Hasun: Here you go, " + ingots + " Mithril Ingots.");
                    inventory.removeMaterialFromInventory("Mithril Ore", 3 * ingots);
                    inventory.removeMaterialFromInventory("Coal", 20 * ingots);
                    inventory.addMaterialToInventory("Mithril Ingot", ingots);
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    if (traveled == false) {
                        dwarvenForge(traveled);
                    } else {
                        App.actionMenu();
                    }
                    break;
                } else {
                    System.out.println("Hasun: You don't have the materials I need.");
                    System.out.println("1. Many apologies");
                    scanner.next();
                    App.clearScreen();
                    if (traveled == false) {
                        dwarvenForge(traveled);
                    } else {
                        App.actionMenu();
                    }
                    break;
                }
            case 2:
                System.out.println("Hasun: Ah, you want to forge some Mithril Armor?");
                System.out.println("Hasun: 8 Mithril Ingots & 2 Leather will do the trick.");

                System.out.println("0. Leave");
                System.out.println("1. Forge Mithril Armor");;

                try {
                    choice = scanner.nextInt();
                    App.clearScreen();
                } catch (InputMismatchException e) {
                    System.out.println("Invalid input, please try again.");
                    App.clearScreen();
                    dwarvenForge(traveled);
                }

                if (choice == 0) {
                    if (traveled == false) {
                        dwarvenForge(traveled);
                    } else {
                        App.actionMenu();
                    }
                    break;
                } else if (choice == 1) {
                    if (inventory.getMaterialAmount("Mithril Ingot") >= 8 && inventory.getMaterialAmount("Leather") >= 2) {
                        System.out.println("Hasun: Alright, I'll get to work...\n");
  
                        inventory.removeMaterialFromInventory("Mithril Ingot", 8);
                        inventory.removeMaterialFromInventory("Leather", 2);

                        Armor armor = new Armor("Mithril", player.getLevel(), 40000, false, false);
                        Generation.filterLoot(armor);

                        System.out.println("You have aquired " + armor.getName() + "!");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        if (traveled == false) {
                            dwarvenForge(traveled);
                        } else {
                            App.actionMenu();
                        }
                        break;
                    } else {
                        System.out.println("Hasun: You don't have the materials I need.");
                        System.out.println("1. Many apologies");
                        scanner.next();
                        App.clearScreen();
                        if (traveled == false) {
                            dwarvenForge(traveled);
                        } else {
                            App.actionMenu();
                        }
                        break;
                    }
                }
            case 3:
                String weaponType = "";

                System.out.println("Hasun: Ah, you want to forge some Mithril Weapons?");
                System.out.println("Hasun: 4 Mithril Ingots, 1 Wood & 1 Leather will do the trick.");

                System.out.println("0. Leave");
                System.out.println("1. Forge Sword");
                System.out.println("2. Forge Dagger");
                System.out.println("3. Forge Staff");

                try {
                    choice = scanner.nextInt();
                    App.clearScreen();
                } catch (InputMismatchException e) {
                    System.out.println("Invalid input, please try again.");
                    App.clearScreen();
                    dwarvenForge(traveled);
                }

                switch (choice) {
                    case 0:
                        if (traveled == false) {
                            dwarvenForge(traveled);
                        } else {
                            App.actionMenu();
                        }
                        break;
                    case 1:
                        weaponType = "Sword";
                        break;
                    case 2:
                        weaponType = "Dagger";
                        break;
                    case 3:
                        weaponType = "Staff";
                        break;
                }

                if (inventory.getMaterialAmount("Mithril Ingot") >= 4 && inventory.getMaterialAmount("Wood") >= 1 && inventory.getMaterialAmount("Leather") >= 1) {
                    System.out.println("Hasun: Alright, I'll get to work...\n");

                    inventory.removeMaterialFromInventory("Mithril Ingot", 4);
                    inventory.removeMaterialFromInventory("Wood", 1);
                    inventory.removeMaterialFromInventory("Leather", 1);

                    String weaponName = "Mithril " + weaponType;

                    Weapon weapon = new Weapon(weaponName, weaponType, "Mithril", player.getLevel(), 32000, false, false);
                    Generation.filterLoot(weapon);

                    System.out.println("You have aquired " + weapon.getName() + "!");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    if (traveled == false) {
                        dwarvenForge(traveled);
                    } else {
                        App.actionMenu();
                    }
                    break;
                } else {
                    System.out.println("Hasun: You don't have the materials I need.");
                    System.out.println("1. Many apologies");
                    scanner.next();
                    App.clearScreen();
                    if (traveled == false) {
                        dwarvenForge(traveled);
                    } else {
                        App.actionMenu();
                    }
                    break;
                }
            case 4:
                if (variables.getDwarvenForge() == false) {
                    System.out.println("Hasun: You want me to move to town?");
                    System.out.println("Hasun: Hmmmmm, I suppose the market is better there.");
                    System.out.println("Hasun: I'll move if you can cover my moving expenses.");
                    System.out.println("Hasun: I'll need 250,000 gold to move all my equipment.");
                    System.out.println("Hasun: What do you say?\n");

                    System.out.println("1. I'll pay the 250,000 gold");
                    System.out.println("2. I don't have that kind of money");

                    choice = scanner.nextInt();
                    App.clearScreen();

                    if (choice == 1) {
                        if (player.getGold() >= 250000) {
                            player.setGold(player.getGold() - 250000);
                            variables.setDwarvenForge(true);

                            System.out.println("Hasun: Great! I'll start packing up my things.");
                            System.out.println("Hasun: I'll meet you in town soon!\n");

                            System.out.println("Hasun gets to work packing up his things.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("Hasun: You don't have enough gold!");
                            System.out.println("1. Many apologies");
                            scanner.next();
                            App.clearScreen();
                            if (traveled == false) {
                                dwarvenForge(traveled);
                            } else {
                                App.actionMenu();
                            }
                            break;
                        }
                    } else if (choice == 2) {
                        System.out.println("Hasun: Oh, well I guess I'll stay here then.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        if (traveled == false) {
                            dwarvenForge(traveled);
                        } else {
                            App.actionMenu();
                        }
                        break;
                    }
                }
        }
    }

    public void pyramid() {
        Player player = App.getPlayer();
        Scanner scanner = new Scanner(System.in);
        Inventory inventory = App.getInventory();
        int choice = 0;
        int blessings = 0;
        Boolean xolgroth = false;
        Boolean salruth = false;
        Boolean zolgadiyun = false;

        for (int i = 0; i < player.getBlessings().length; i++) {
            if (player.getBlessings()[i].equals("Disciple of Xolgroth")) {
                xolgroth = true;
                blessings++;
            } else if (player.getBlessings()[i].equals("Salruth's Acolyte")) {
                salruth = true;
                blessings++;
            } else if (player.getBlessings()[i].equals("Zolgadiyun's Champion")) {
                zolgadiyun = true;
                blessings++;
            }
        }

        // If the player has one or more of the blessings, and is human or astral
        if (((xolgroth == true || salruth == true || zolgadiyun == true)) && (player.getRace().equals("Human") || player.getRace().equals("Astral"))) {
            System.out.println("You travel through the desert and suddenly a sandstorm appears.");
            System.out.println("You try to find shelter, but the sandstorm is too strong.");
            System.out.println("You are knocked unconscious by the sandstorm.\n");

            System.out.println("You wake up in a pyramid, you have no idea how you got here.");
            System.out.println("You look around and see symbols on the walls.");
            System.out.println("You recognize the symbols.. It's the names of Nue's children!");
            System.out.println("You get up and start exploring the pyramid.\n");

            System.out.println("After some time you come across a large statue of a demon.");
            System.out.println("You recognize the demon as Nue, the Demon King.");

            System.out.println("You approach the statue and it's mouth opens...");
            System.out.println("Almost as if the weight of the world has been placed on your shoulders, you fall to your knees.");

            System.out.println("1. Continue");
            scanner.next();
            App.clearScreen();

            System.out.println("Nue: Always show respect to your elders young mortal.");
            System.out.println("Nue: Nonetheless, welcome " + player.getName() + ".\n");
            System.out.println("Nue: I saved you from the sandstorm, because you know my children.");

            if ((xolgroth == true && salruth == true && zolgadiyun == true)) {
                System.out.println("Nue: You have been blessed by all three of my children.");
                System.out.println("Nue: I imagine you seek demonship, yes?");

                System.out.println("1. Yes, I wish to become a demon");
                System.out.println("2. No, I was just helping your children");

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        System.out.println("Nue: Hmmm, let's see...");
                        System.out.println("The statue's eyes glow red...");
                        System.out.println("The statue appears to be inspecting you...");
                        System.out.println("Nue: You have been blessed by my children... Even Zolgadiyun...");
                        System.out.println("Nue: Alright, I cannont make you a fully fledged demon...");
                        System.out.println("Nue: However, I can turn you into a Hybrid Demon. Half Human, Half Demon.");
                        System.out.println("Nue: Do you accept my offer?\n");

                        System.out.println("1. Yes, I accept");
                        System.out.println("2. No, I don't want to be a Hybrid Demon");

                        choice = scanner.nextInt();
                        App.clearScreen();

                        if (choice == 2) {
                            System.out.println("Nue: I see... Be on your way then.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                        } else if (choice == 1) {
                            System.out.println("Nue: Very well, this will hurt a lot.\n");
                            System.out.println("Before you can utter a word, you are engulfed in flames.");
                            System.out.println("You feel: your body changing, your bones are breaking and reforming.");
                            System.out.println("Your skin burning, and eyes melting.");
                            System.out.println("Your mind being torn apart, soul being ripped from your body.");
                            System.out.println("But then, your soul is placed back into your body, the pain is gone... the fire is gone...");
                            System.out.println("1. Continue");

                            scanner.next();
                            App.clearScreen();

                            System.out.println("A mirror appears in front of you.");
                            System.out.println("You look into the mirror and see your reflection.");
                            System.out.println("You still appear mostly human, but now your left half has been demonized.");
                            System.out.println("Your left side has a red eye, horn, and wing.");
                            System.out.println("1. Continue");

                            scanner.next();
                            App.clearScreen();

                            System.out.println("You Have Evolved.\n" + "Human -> Hybrid Demon\n");
                            player.setRace("Hybrid Demon");

                            player.setMaxHealth((int) (player.getMaxHealth() * 1.5));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth()); }
                            player.setPowerMax(player.getPowerMax() + 100);
                            player.setDefense((int) (player.getDefense() * 2));

                            System.out.println("Nue: You are now a Hybrid Demon, with this you have gained quite a lot...");
                            System.out.println("Nue: Your max health has been increased by 50%");
                            System.out.println("Nue: Your max power has been increased by 100");
                            System.out.println("Nue: Your defense has been increased by 100%");
                            System.out.println("Nue: You can increase your demonic powers by consuming Demon Hearts");
                            System.out.println("Nue: The more you consume the more powers you'll be able to unlock with Demon Souls\n");

                            System.out.println("Nue: Now go child of mine, spread your wing... And make me proud.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            demonTutorial();
                        }
                        break;
                    case 2:
                        System.out.println("Nue: I see... Take this then and be on your way.");
                        System.out.println("Nue has gifted you with 1 Demon Soul!");
                        inventory.addMaterialToInventory("Demon Soul", 1);
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                }
            }

            System.out.println("Nue: You have been blessed by " + blessings + " of my children.");
            System.out.println("Nue: You still need to be blessed by " + (3 - blessings) + " of my children before I can speak to you freely.");
            System.out.println("Nue: I must send you back now, take this with you.\n");

            System.out.println("Dust falls out of the statue's mouth...");
            System.out.println("You pick up the dust...");
            System.out.println("You have aquired 10 Dust!");
            inventory.addMaterialToInventory("Dust", 10);

            System.out.println("Suddenly you are back in the desert, the sandstorm is gone.");
            System.out.println("You look around and see nothiing bust sand.");
            System.out.println("You decide to continue on your journey.");

            System.out.println("1. Continue");
            scanner.next();
            App.clearScreen();
            App.actionMenu();

        } else if (player.getRace().equals("Human") || player.getRace().equals("Astral")) {
            System.out.println("You travel through the desert and see a pyramid in the distance.");
            System.out.println("You approach the pyramid and find the entrance.");
            System.out.println("As soon as you cross the threshold, you are knocked unconscious.\n");

            System.out.println("You wake up back in the desert with an incredible headache.");
            System.out.println("All you know is that you're not ready to enter the pyramid yet.");
            System.out.println("You decide to continue on your journey.");
            System.out.println("1. Continue");
            scanner.next();
            App.clearScreen();
            App.actionMenu();
        } else if (player.getRace().equals("Hybrid Demon")) {
            System.out.println("You travel through the desert and see Nue's pyramid in the distance.");
            System.out.println("You enter the pyramid and find the statue of Nue.");
            System.out.println("You approach the statue.\n");

            System.out.println("Nue: How may I help you my child?\n");

            System.out.println("1. Leave");
            System.out.println("2. I wish to become a full fledged demon");

            choice = scanner.nextInt();
            App.clearScreen();

            if (choice == 1) {
                App.clearScreen();
                App.actionMenu();
            } else if (choice == 2) {
                System.out.println("Nue: You are not ready yet my child.");
                System.out.println("Nue: Continue to grow and come back when you are ready.");
                System.out.println("1. Continue");
                scanner.next();
                App.clearScreen();
                App.actionMenu();
            }
        }
    }

    public void demonTutorial() {
        Scanner scanner = new Scanner(System.in);
        Inventory inventory = App.getInventory();

        System.out.println("You are now a Hybrid Demon!");
        System.out.println("Let's go over the basics.\n");
        System.out.println("There are 9 levels to your demonic powers.");
        System.out.println("You can increase your demonic powers by consuming Demon Hearts.");
        System.out.println("Each level requires more Demon Hearts than the last.");
        System.out.println("Each time you level up your stats will increase.");
        System.out.println("You can also unlock new abilities/skills by leveling up!\n");
        System.out.println("Abilities/skills are unlocked with Demon Souls.");
        System.out.println("You can view your demonic progress in the Character Menu.\n");

        System.out.println("Here's a complimentary Demon Soul to get you started!");
        inventory.addMaterialToInventory("Demon Soul", 1);

        System.out.println("1. Continue");
        scanner.next();
        App.clearScreen();
        App.actionMenu();
    }
}
