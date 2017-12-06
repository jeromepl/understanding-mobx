import { v4 as uuid } from "uuid";


type Derivation = {
    dependencies: Set<string>, // Set (ES2015) of observable UUIDs
    fn: () => void // The function to run when one of the dependencies has changed
}

const reactions: Derivation[] = [];
let inTransaction: boolean = false;
let changesDuringTransaction: string[] = [];
let evaluatingDerivation: boolean = false;
let derivationDependencies: string[] = []; // Explicit access to the top of the 'derivationDependenciesStack'
let derivationDependenciesStack: (string[])[] = [derivationDependencies];

// For this demo, only support @observable someProp. No support for Arrays and Maps
export function observable(object: any, key: string): any {
    let val: any;
    const observableUUID: string = uuid() + key;
    return {
        enumerable: false,
        configurable: true,
        get: function() {
            if (evaluatingDerivation) {
                derivationDependencies.push(observableUUID);
            }
            return val;
        },
        set: function(newVal: any) {
            const oldVal = val;
            val = newVal;
            if (val !== oldVal) { // Something changed, trigger actions
                console.log(`${key} set to ${val}`);
                triggerReactions(observableUUID);
            }
        }
    }
}

function triggerReactions(observableUUID: string | string[]) {
    if (inTransaction) {
        changesDuringTransaction = changesDuringTransaction.concat(observableUUID);
        return;
    }

    for (let reaction of reactions) { // This is where a bottleneck could be. I believe that in MobX, observables store what reactions they affect for better performance
        if (setContainsOneOf(reaction.dependencies, observableUUID)) {
            evaluateDerivation(reaction); // Only run if the reaction has one of the changed observables as dependency
        }
    }
}

function evaluateDerivation(derivation: Derivation) {
    evaluatingDerivation = true;
    derivation.fn(); // Run the reaction, while keeping track of what is accessed
    evaluatingDerivation = false;

    derivation.dependencies = new Set(derivationDependencies);
    derivationDependencies = [];
}

function setContainsOneOf<T>(set: Set<T>, thingsToFind: T|T[]): boolean {
    if (!(thingsToFind instanceof Array)) thingsToFind = [thingsToFind];

    for (let thingToFind of thingsToFind) if (set.has(thingToFind)) return true;
    return false;
}

export function computed(object: any, key: string) {
    return {
        get: undefined
    };
    // TODO
    // Gonna run into issues with current architecture when trying to find the reaction dependencies of a @computed function during the evaluation of a Reaction
    // Gonna need a stack of dependency arrays to solve that
}

export function transaction(fn: () => void) {
    inTransaction = true;
    fn();
    inTransaction = false;

    triggerReactions(changesDuringTransaction);
    changesDuringTransaction = [];
}

export function autorun(fn: () => void) {
    console.log("Setup Autorun");
    const reaction: Derivation = {
        dependencies: new Set(),
        fn
    };
    evaluateDerivation(reaction); // Run it initially. This also allows to figure out the (initial) dependencies of that reaction
    reactions.push(reaction);
}
