import Derivation from './Derivation';


/**
 * An Observable is a value that, when updated, will automatically trigger an update
 * in any reactions that are dependent on it.
 */
type Observable = {
    val: any,
    derivations: Set<Derivation>
};

export default Observable;