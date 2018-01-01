import { Observable, Derivation, Computed } from './objects';


let inTransaction: boolean = false;
let derivationsDuringTransaction = new Set<Derivation>();
// let derivationDependenciesStack: (string[])[] = [derivationDependencies];

/**
 * Decorator to indicate that a class property is an Observable, thus triggering any Computed values or Reactions
 * whenever the value of this Observable changes.
 * For this demo, this only supports `@observable someProp`. No support for Arrays and Maps.
 */
export function observable(obj: any, prop: string): any {
    const observable = {
        derivations: new Set<Derivation>(),
        val: undefined
    };
    return {
        enumerable: false,
        configurable: true,
        get: () => {
            if (Derivation.derivationEvaluated) {
                observable.derivations.add(Derivation.derivationEvaluated);
            }
            return observable.val;
        },
        set: (newVal: any) => {
            const oldVal = observable.val;
            observable.val = newVal;
            if (observable.val !== oldVal) { // Something changed, trigger actions
                triggerDerivations(observable.derivations);
            }
        }
    }
}

/**
 * Triggering derivations after an observable changes is done in two stages.
 * 1 - Send a 'stale' notification that propagates all the way through the dependency tree.
 * Each Derivation keeps track of the number of 'stale' notification it receives, which tells it how many dependencies it has to wait on.
 * 2 - Send a 'ready' notification to the Derivations directly affected (without going through computed values) by the original obsrvable change.
 * Once a Derivation has received as many 'ready' notifications as it has received 'stale' notifications (and that at least one of their values changed),
 * it in turn sends a 'ready' notification to its direct dependents, along with whether its value has changed.
 * run this in 2 waves. 1 - Send 'stale' notifications to all derivations. The derivations will count the number of stale notifications they get.
*/
function triggerDerivations(derivations: Set<Derivation>) {
    if (inTransaction) {
        for (let derivation of derivations) derivationsDuringTransaction.add(derivation);
        return;
    }

    // Mark any accessed derivation as stale
    for (let derivation of derivations) derivation.markStale();
    // Then send 'ready' notifications to all derivations once a depencency has finished evaluating
    // A derivation is always re-evaluated when it is triggered in order to update its Observable dependencies
    for (let derivation of derivations) derivation.sendReady(true);
}

/**
 * A computed value is cached and only re-computed whenever an observable on which this is dependent changes value.
 * This thus assumes that computed methods are pure. Computed values act as both observables and derivations
 * since they are updated by observables and update the derivations that depend on this.
 * In MobX, the value is also garbage collected if there are no listeners.
 */
export function computed<T>(obj: any, prop: string, descriptor: TypedPropertyDescriptor<T>): any {
    if (!descriptor.get) return descriptor;

    const originalGetter = descriptor.get.bind(obj); // The original getter lives in descriptor.get
    const observable: Observable = {
        val: undefined,
        derivations: new Set<Derivation>()
    };

    const computed = new Computed(observable, originalGetter);

    computed.evaluate(); // Initialize

    return {
        enumerable: false,
        configurable: true,
        get: () => {
            if (Derivation.derivationEvaluated) {
                observable.derivations.add(Derivation.derivationEvaluated);
            }
            return observable.val;
        }
    };
}

/**
 * Runs the given method 'fn' while keeping track of all affected Reactions.
 * All these Reactions are then triggered once after 'fn' has completed.
 */
export function transaction(fn: () => void) {
    inTransaction = true;
    fn();
    inTransaction = false;

    triggerDerivations(derivationsDuringTransaction);
    derivationsDuringTransaction = new Set<Derivation>();
}

/**
 * Runs the given method whenever an Observable or a Computed value used inside changes value.
 * Evaluates the Observable dependencies at runtime, thus only running when absolutely necessary.
 */
export function autorun(fn: () => void) {
    const reaction = new Derivation(fn);
    reaction.evaluate(); // Run it initially. This also allows to figure out the (initial) dependencies of that reaction
}
